/**
 * Complétude « intégrale » d'un palier prospect.
 *
 * Distincte de la notion de palier « atteint » (≥ 1 champ) utilisée par le
 * BUUPP Score (`lib/prospect/score.ts`) et l'affichage de complétude : ici un
 * palier n'est COMPLET que si TOUS ses champs sont renseignés.
 *
 * Sert de condition à l'ACCEPTATION d'une sollicitation : un prospect ne peut
 * accepter une mise en relation que si tous les paliers exigés par la campagne
 * (`campaign.targeting.requiredTiers`) sont intégralement renseignés. Appliqué
 * côté serveur dans `POST /api/prospect/relations/[id]/decision` (action
 * `accept`) et reflété côté UI dans `public/prototype/components/Prospect.jsx`.
 *
 * ⚠ Source de vérité des champs : `DATA_CATEGORIES[].fields` dans
 * `public/prototype/components/Prospect.jsx`. Toute modification d'un champ
 * affiché doit être répercutée ici (colonnes DB, snake_case).
 */

import { TIERS, type TierKey } from "./donnees";

/** Colonnes DB qui doivent toutes être non vides pour qu'un palier soit
 *  considéré « intégralement renseigné ». Les champs de préférence de
 *  ciblage (targeting_radius_km, national_opt_in) et les sous-champs de
 *  détail optionnels (animaux_detail, vehicule_marque) en sont exclus. */
export const REQUIRED_TIER_FIELDS: Record<TierKey, string[]> = {
  identity: ["prenom", "nom", "email", "telephone", "naissance"],
  localisation: ["adresse", "ville", "code_postal", "region"],
  vie: ["foyer", "logement", "mobilite", "vehicule", "sports", "animaux"],
  pro: ["statut", "secteur"],
  patrimoine: ["residence", "projets"],
};

/** Mapping numéro de palier (1..5) → clé de catégorie. */
export const TIER_NUM_TO_KEY: Record<number, TierKey> = {
  1: "identity",
  2: "localisation",
  3: "vie",
  4: "pro",
  5: "patrimoine",
};

/** Normalise la liste `requiredTiers` d'une campagne en numéros 1..5 uniques
 *  et triés. Liste absente/vide → [1] (identité), cohérent avec le reste du
 *  code (matching, mapping). */
export function normalizeRequiredTierNums(requiredTiers: unknown): number[] {
  if (!Array.isArray(requiredTiers) || requiredTiers.length === 0) return [1];
  const cleaned = [
    ...new Set(
      requiredTiers
        .map((n) => Math.round(Number(n) || 0))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5),
    ),
  ].sort((a, b) => a - b);
  return cleaned.length > 0 ? cleaned : [1];
}

function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  return v !== "";
}

/** true si TOUS les champs requis du palier sont renseignés dans `row`. */
export function isTierRowComplete(
  tier: TierKey,
  row: Record<string, unknown> | null | undefined,
): boolean {
  if (!row) return false;
  return REQUIRED_TIER_FIELDS[tier].every((col) => isFilled(row[col]));
}

/** Renvoie les numéros de paliers requis qui ne sont PAS intégralement
 *  renseignés, à partir des rows fetchées (clé = TierKey). */
export function missingRequiredTierNums(
  requiredTierNums: number[],
  rows: Partial<Record<TierKey, Record<string, unknown> | null>>,
): number[] {
  return requiredTierNums.filter((num) => {
    const key = TIER_NUM_TO_KEY[num];
    if (!key) return false;
    return !isTierRowComplete(key, rows[key] ?? null);
  });
}

/** Nom de table Supabase pour un palier (réexport pratique de TIERS). */
export function tierTable(tier: TierKey): TierMapTable {
  return TIERS[tier].table;
}

type TierMapTable = (typeof TIERS)[TierKey]["table"];
