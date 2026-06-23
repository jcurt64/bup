/**
 * Calcul du BUUPP Score d'un prospect — partagé entre l'endpoint
 * `/api/prospect/score` (GET, à la demande) et `/api/prospect/donnees`
 * (PATCH, recompute automatique après chaque modification de palier).
 *
 * Le score (0..1000) repose sur trois critères pondérés à parts égales :
 *   - complétude des paliers (un palier compte dès qu'au moins un de
 *     ses champs est renseigné — aligné avec la logique de matching pro)
 *   - fraîcheur (basée sur le MAX(updated_at) parmi les paliers remplis)
 *   - fiabilité : moyenne BAYÉSIENNE des notes données par les pros (sur les
 *     prospects qu'ils ont mis en relation) — Haute=100 / Moyenne=60 / Basse=20,
 *     une note par pro distinct, lissée vers un prior neutre (m₀=60, C=3) ;
 *     neutre (60) si jamais notée. Remplace l'ancien « taux d'acceptation ».
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

/** Points de fiabilité par niveau de note pro (1=Haute, 2=Moyenne, 3=Basse). */
export const FIABILITE_POINTS: Record<number, number> = { 1: 100, 2: 60, 3: 20 };

/** Prior neutre (= « Moyenne ») : valeur vers laquelle on tire la moyenne tant
 *  qu'il y a peu d'avis, et valeur d'un prospect jamais noté. */
export const FIABILITE_PRIOR_M0 = 60;
/** Force du lissage : nombre d'avis « fictifs » au prior. Plus C est grand,
 *  plus il faut d'avis réels pour s'éloigner du neutre. */
export const FIABILITE_PRIOR_C = 3;

/**
 * Fiabilité agrégée (0-100) à partir d'UNE note par pro distinct, en moyenne
 * BAYÉSIENNE lissée vers le prior neutre :
 *
 *     fiabilité = (C·m₀ + Σ points) / (C + n)
 *
 * avec m₀=60, C=3. Tableau vide → m₀ (60, neutre) : un prospect jamais noté
 * n'est ni avantagé ni pénalisé. 1 avis pèse peu, beaucoup d'avis convergent
 * vers la vraie moyenne. Les niveaux inconnus sont ignorés.
 */
export function fiabilitePctFromRatings(levels: number[]): number {
  const pts = levels
    .map((l) => FIABILITE_POINTS[l])
    .filter((p): p is number => typeof p === "number");
  const n = pts.length;
  const sum = pts.reduce((s, p) => s + p, 0);
  return Math.round(
    (FIABILITE_PRIOR_C * FIABILITE_PRIOR_M0 + sum) / (FIABILITE_PRIOR_C + n),
  );
}

/** Applique le malus de non-réponse (`prospects.score_malus`) au score brut,
 *  borné à 0. Un malus négatif est ignoré (ne doit jamais bonifier). Cf.
 *  lib/prospect/non-response.ts. */
export function applyScoreMalus(rawScore: number, malus: number): number {
  return Math.max(0, rawScore - Math.max(0, malus));
}

export type ProspectScoreBreakdown = {
  score: number;
  completenessPct: number;
  filledTiers: number;
  countedTiers: number;
  freshnessPct: number;
  lastUpdate: string | null;
  ageDays: number | null;
  /** Fiabilité agrégée 0-100 (moyenne bayésienne des notes pros). Neutre (60)
   *  si jamais notée. */
  fiabilitePct: number;
  /** Nombre de pros distincts ayant noté ce prospect. */
  fiabiliteCount: number;
  /** Répartition des notes (nb de pros distincts par niveau). Sert à la carte
   *  « Mon taux de fiabilité » côté prospect — sans identité des pros. */
  fiabiliteByLevel: { haute: number; moyenne: number; basse: number };
};

export async function computeAndPersistProspectScore(
  admin: SupabaseClient<Database>,
  prospectId: string,
): Promise<ProspectScoreBreakdown> {
  const [identity, localisation, vie, pro, patrimoine, prospect, relRatings] =
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
        .select("removed_tiers, score_malus")
        .eq("id", prospectId)
        .single(),
      // Notes pros (fiabilité) : une ligne par relation notée, la plus récente
      // d'abord → on retient une note par pro distinct (cf. agrégat ci-dessous).
      admin
        .from("relations")
        .select("pro_account_id, pro_priority, decided_at")
        .eq("prospect_id", prospectId)
        .not("pro_priority", "is", null)
        .order("decided_at", { ascending: false }),
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

  // Fiabilité : une note par pro distinct (la plus récente, l'ordre desc
  // garantit que le premier vu pour un pro est le dernier en date).
  const ratingByPro = new Map<string, number>();
  for (const r of relRatings.data ?? []) {
    const proAcc = r.pro_account_id as string | null;
    const lvl = r.pro_priority as number | null;
    if (!proAcc || lvl == null || ratingByPro.has(proAcc)) continue;
    ratingByPro.set(proAcc, lvl);
  }
  const fiabiliteLevels = [...ratingByPro.values()];
  const fiabiliteCount = fiabiliteLevels.length;
  const fiabilitePct = fiabilitePctFromRatings(fiabiliteLevels);
  const fiabiliteByLevel = { haute: 0, moyenne: 0, basse: 0 };
  for (const lvl of fiabiliteLevels) {
    if (lvl === 1) fiabiliteByLevel.haute += 1;
    else if (lvl === 2) fiabiliteByLevel.moyenne += 1;
    else if (lvl === 3) fiabiliteByLevel.basse += 1;
  }

  const avgPct = (completenessPct + freshnessPct + fiabilitePct) / 3;
  // Malus de non-réponse persistant (cf. lib/prospect/non-response.ts) soustrait
  // du score brut. Stocké à part pour survivre aux recomputes (sinon écrasé).
  const malus = (prospect.data?.score_malus ?? 0) as number;
  const score = applyScoreMalus(Math.round(avgPct * 10), malus);

  // `fiabilite_pct` dénormalisé sur prospects : NULL quand jamais notée (pour
  // distinguer « non notée » de « notée 0 » dans le filtre de ciblage), sinon
  // l'agrégat 0-100. Alimente l'étape 4 (fiabilité minimum) et la désirabilité.
  await admin
    .from("prospects")
    .update({
      bupp_score: score,
      fiabilite_pct: fiabiliteCount > 0 ? fiabilitePct : null,
    })
    .eq("id", prospectId);
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
        fiabilite_pct: fiabilitePct,
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
    fiabilitePct,
    fiabiliteCount,
    fiabiliteByLevel,
  };
}
