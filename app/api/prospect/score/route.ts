/**
 * GET /api/prospect/score — calcule le BUUPP Score (sur 1000) du prospect
 * connecté et le persiste dans `prospects.bupp_score`.
 *
 * Trois critères pondérés équitablement (1/3 chacun → moyenne pure) :
 *
 *   1. Complétude des paliers (0–100 %) :
 *        - 1 palier renseigné = 20 % ; 5/5 paliers = 100 %.
 *        - Un palier est dit "renseigné" dès qu'au moins un de ses champs
 *          est non-vide. Les paliers marqués `removed_tiers` sont retirés
 *          du dénominateur (l'utilisateur a exercé son droit à l'effacement
 *          sur ce palier — on ne le pénalise pas pour ça).
 *
 *   2. Fraîcheur des données (0–100 %) :
 *        - Toute mise à jour < 6 mois → 100 %
 *        - Sinon ≤ 12 mois → garde 100 % (zone tolérée par le brief)
 *        - > 12 mois et ≤ 24 mois → 50 %
 *        - > 24 mois → 25 %
 *        - Aucune donnée saisie → 0 %
 *      On prend le `MAX(updated_at)` parmi les 5 tier rows comme proxy de
 *      la dernière modification utilisateur.
 *
 *   3. Taux d'acceptation des sollicitations (0–100 %) :
 *        - count(relations.status ∈ {accepted, settled}) / count(relations totales) × 100
 *        - On compte `settled` comme une acceptation : c'est une relation
 *          que le prospect a acceptée et dont le délai de validation est
 *          déjà passé (les fonds ont été crédités).
 *        - 0 sollicitation reçue → 0 % (neutre, pas pénalisant tant que
 *          le score est dominé par les deux autres axes).
 *
 * Le critère "Évaluations positives" a été retiré du calcul à la demande
 * du PO (mai 2026) — pas de table de notation côté prestataire.
 *
 * Score final = round((complétude + fraîcheur + acceptation) / 3 × 10).
 * → barème 0..1000 directement comparable à `prospects.bupp_score`.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import { TIERS, TIER_KEYS, type TierKey } from "@/lib/prospect/donnees";

export const runtime = "nodejs";

const TOTAL_TIERS = 5;
const PER_TIER_PCT = 100 / TOTAL_TIERS; // 20 %

const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
const TWO_YEARS_MS = ONE_YEAR_MS * 2;

function freshnessPctFromAge(ageMs: number | null): number {
  if (ageMs == null) return 0;
  if (ageMs <= ONE_YEAR_MS) return 100; // ≤ 1 an (englobe le seuil 6 mois)
  if (ageMs <= TWO_YEARS_MS) return 50; // 1–2 ans
  return 25; // > 2 ans
}

async function getProspectId(userId: string): Promise<string> {
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  return ensureProspect({
    clerkUserId: userId,
    email,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const prospectId = await getProspectId(userId);
  const admin = createSupabaseAdminClient();

  // Lecture parallèle de tous les paliers + de la row maître + des relations
  // pour le taux d'acceptation. On ne stresse pas la DB : 7 requêtes au max,
  // toutes indexées sur prospect_id ou status.
  const [identity, localisation, vie, pro, patrimoine, prospect, relTotal, relAccepted] =
    await Promise.all([
      admin
        .from("prospect_identity")
        .select("prenom, nom, email, telephone, naissance, updated_at")
        .eq("prospect_id", prospectId)
        .maybeSingle(),
      admin
        .from("prospect_localisation")
        .select("adresse, ville, code_postal, logement, mobilite, updated_at")
        .eq("prospect_id", prospectId)
        .maybeSingle(),
      admin
        .from("prospect_vie")
        .select("foyer, sports, animaux, vehicule, updated_at")
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

  // ─── Complétude ─────────────────────────────────────────────────
  // On ignore les paliers explicitement supprimés via le droit à
  // l'effacement (ils sortent du dénominateur ET du numérateur).
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

  // ─── Fraîcheur ──────────────────────────────────────────────────
  // Plus récente date de mise à jour parmi les paliers où l'utilisateur
  // a effectivement saisi quelque chose. Si aucun palier rempli → 0 %.
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

  // ─── Taux d'acceptation ─────────────────────────────────────────
  const totalRelations = relTotal.count ?? 0;
  const acceptedRelations = relAccepted.count ?? 0;
  const acceptancePct =
    totalRelations === 0
      ? 0
      : Math.round((acceptedRelations / totalRelations) * 100);

  // ─── Score final ────────────────────────────────────────────────
  const avgPct = (completenessPct + freshnessPct + acceptancePct) / 3;
  const score = Math.round(avgPct * 10); // 0..1000

  // Persistance : la colonne a une CHECK 0..1000.
  await admin.from("prospects").update({ bupp_score: score }).eq("id", prospectId);

  // Snapshot journalier (1 row max par jour et par prospect via PK
  // composite). Alimente le graphique "Évolution" du panel BUUPP Score
  // sans surcoût — l'upsert est idempotent.
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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

  return NextResponse.json({
    score,
    breakdown: {
      completeness: {
        pct: completenessPct,
        filled: filledTiers,
        total: countedTiers,
        perTier: PER_TIER_PCT,
      },
      freshness: {
        pct: freshnessPct,
        lastUpdate: mostRecentTs ? new Date(mostRecentTs).toISOString() : null,
        ageDays: ageMs == null ? null : Math.floor(ageMs / 86_400_000),
      },
      acceptance: {
        pct: acceptancePct,
        accepted: acceptedRelations,
        total: totalRelations,
      },
    },
  });
}
