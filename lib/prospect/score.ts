/**
 * Calcul du BUUPP Score d'un prospect — partagé entre l'endpoint
 * `/api/prospect/score` (GET, à la demande) et `/api/prospect/donnees`
 * (PATCH, recompute automatique après chaque modification de palier).
 *
 * Le score (0..1000) repose sur trois critères pondérés à parts égales :
 *   - complétude des paliers (un palier compte dès qu'au moins un de
 *     ses champs est renseigné — aligné avec la logique de matching pro)
 *   - fraîcheur (basée sur le MAX(updated_at) parmi les paliers remplis)
 *   - taux d'acceptation des sollicitations (accepted+settled / total)
 *
 * Un snapshot quotidien est upserté dans `prospect_score_history` pour
 * alimenter le graphique d'évolution (idempotent : 1 row max / jour).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { TIERS, TIER_KEYS, type TierKey } from "./donnees";

const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
const TWO_YEARS_MS = ONE_YEAR_MS * 2;

function freshnessPctFromAge(ageMs: number | null): number {
  if (ageMs == null) return 0;
  if (ageMs <= ONE_YEAR_MS) return 100;
  if (ageMs <= TWO_YEARS_MS) return 50;
  return 25;
}

export type ProspectScoreBreakdown = {
  score: number;
  completenessPct: number;
  filledTiers: number;
  countedTiers: number;
  freshnessPct: number;
  lastUpdate: string | null;
  ageDays: number | null;
  acceptancePct: number;
  acceptedRelations: number;
  totalRelations: number;
};

export async function computeAndPersistProspectScore(
  admin: SupabaseClient<Database>,
  prospectId: string,
): Promise<ProspectScoreBreakdown> {
  const [identity, localisation, vie, pro, patrimoine, prospect, relTotal, relAccepted] =
    await Promise.all([
      admin
        .from("prospect_identity")
        .select("prenom, nom, email, telephone, naissance, updated_at")
        .eq("prospect_id", prospectId)
        .maybeSingle(),
      admin
        .from("prospect_localisation")
        .select("adresse, ville, code_postal, updated_at")
        .eq("prospect_id", prospectId)
        .maybeSingle(),
      admin
        .from("prospect_vie")
        .select("foyer, sports, animaux, vehicule, logement, mobilite, updated_at")
        .eq("prospect_id", prospectId)
        .maybeSingle(),
      admin
        .from("prospect_pro")
        .select("poste, statut, secteur, revenus, updated_at")
        .eq("prospect_id", prospectId)
        .maybeSingle(),
      admin
        .from("prospect_patrimoine")
        .select("residence, epargne, projets, updated_at")
        .eq("prospect_id", prospectId)
        .maybeSingle(),
      admin
        .from("prospects")
        .select("removed_tiers")
        .eq("id", prospectId)
        .single(),
      admin
        .from("relations")
        .select("id", { count: "exact", head: true })
        .eq("prospect_id", prospectId),
      admin
        .from("relations")
        .select("id", { count: "exact", head: true })
        .eq("prospect_id", prospectId)
        .in("status", ["accepted", "settled"]),
    ]);

  const tierRows: Record<TierKey, Record<string, unknown> | null> = {
    identity: identity.data,
    localisation: localisation.data,
    vie: vie.data,
    pro: pro.data,
    patrimoine: patrimoine.data,
  };
  const removedTiers = new Set<TierKey>(
    (prospect.data?.removed_tiers ?? []) as TierKey[],
  );

  let filledTiers = 0;
  let countedTiers = 0;
  for (const tier of TIER_KEYS) {
    if (removedTiers.has(tier)) continue;
    countedTiers += 1;
    const row = tierRows[tier];
    const hasAtLeastOneField =
      row != null &&
      Object.entries(TIERS[tier].fields).some(([, dbCol]) => {
        const v = row[dbCol];
        return typeof v === "string" && v.trim() !== "";
      });
    if (hasAtLeastOneField) filledTiers += 1;
  }
  const completenessPct =
    countedTiers === 0 ? 0 : Math.round((filledTiers / countedTiers) * 100);

  let mostRecentTs: number | null = null;
  for (const tier of TIER_KEYS) {
    const row = tierRows[tier];
    if (!row) continue;
    const hasField = Object.entries(TIERS[tier].fields).some(([, dbCol]) => {
      const v = row[dbCol];
      return typeof v === "string" && v.trim() !== "";
    });
    if (!hasField) continue;
    const u = row["updated_at"];
    if (typeof u === "string") {
      const ts = Date.parse(u);
      if (!Number.isNaN(ts) && (mostRecentTs == null || ts > mostRecentTs)) {
        mostRecentTs = ts;
      }
    }
  }
  const ageMs = mostRecentTs == null ? null : Date.now() - mostRecentTs;
  const freshnessPct = freshnessPctFromAge(ageMs);

  const totalRelations = relTotal.count ?? 0;
  const acceptedRelations = relAccepted.count ?? 0;
  const acceptancePct =
    totalRelations === 0
      ? 0
      : Math.round((acceptedRelations / totalRelations) * 100);

  const avgPct = (completenessPct + freshnessPct + acceptancePct) / 3;
  const score = Math.round(avgPct * 10);

  await admin.from("prospects").update({ bupp_score: score }).eq("id", prospectId);
  const today = new Date().toISOString().slice(0, 10);
  await admin
    .from("prospect_score_history")
    .upsert(
      {
        prospect_id: prospectId,
        snapshot_date: today,
        score,
        completeness_pct: completenessPct,
        freshness_pct: freshnessPct,
        acceptance_pct: acceptancePct,
      },
      { onConflict: "prospect_id,snapshot_date" },
    );

  return {
    score,
    completenessPct,
    filledTiers,
    countedTiers,
    freshnessPct,
    lastUpdate: mostRecentTs ? new Date(mostRecentTs).toISOString() : null,
    ageDays: ageMs == null ? null : Math.floor(ageMs / 86_400_000),
    acceptancePct,
    acceptedRelations,
    totalRelations,
  };
}
