// Complétude « intégrale » d'un palier prospect (miroir mobile).
//
// Source de vérité côté web : `lib/prospect/completeness.ts` (snake_case DB)
// + le garde-fou serveur dans `POST /api/prospect/relations/[id]/decision`
// (422 `tiers_incomplete`). Ici on travaille sur la réponse camelCase de
// `GET /api/prospect/donnees` (cf. `DonneesResp`/`FIELDS` dans
// `app/(prospect)/donnees.tsx`) → les noms de champs sont en camelCase.
//
// Distinct de la notion de palier « atteint » (≥ 1 champ) utilisée par le
// BUUPP Score et la barre de complétude : ici un palier n'est COMPLET que si
// TOUS ses champs requis sont renseignés. C'est la condition pour ACCEPTER
// une sollicitation : tous les paliers exigés par la campagne
// (`campaign.targeting.requiredTiers`, exposés en `tiers` sur la relation)
// doivent être intégralement remplis.
//
// ⚠ Garder ce fichier synchronisé avec le web (mêmes champs requis). Les
// sous-champs de détail optionnels (`animauxDetail`, `vehiculeMarque`) et les
// préférences de ciblage (`targetingRadiusKm`, `nationalOptIn`) en sont
// exclus.
import type { DonneesResp, TierKey } from "./queries";

/** Champs (camelCase) qui doivent TOUS être non vides pour qu'un palier soit
 *  « intégralement renseigné ». Alignés sur REQUIRED_TIER_FIELDS (web). */
export const REQUIRED_TIER_FIELDS: Record<TierKey, string[]> = {
  identity: ["prenom", "nom", "email", "telephone", "naissance"],
  localisation: ["adresse", "ville", "codePostal", "region"],
  vie: ["foyer", "logement", "mobilite", "vehicule", "sports", "animaux"],
  pro: ["poste", "statut", "secteur", "revenus"],
  patrimoine: ["residence", "epargne", "projets"],
};

/** Mapping numéro de palier (1..5) → clé de catégorie. */
export const TIER_NUM_TO_KEY: Record<number, TierKey> = {
  1: "identity",
  2: "localisation",
  3: "vie",
  4: "pro",
  5: "patrimoine",
};

/** Libellé + icône par numéro de palier (parité TIER_META de donnees.tsx) —
 *  utilisé par les modales du gate d'acceptation. */
export const TIER_LABEL: Record<number, string> = {
  1: "Identification",
  2: "Localisation",
  3: "Style de vie",
  4: "Données professionnelles",
  5: "Patrimoine & projets",
};

function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  return v !== "";
}

/** Normalise la liste `requiredTiers` d'une campagne en numéros 1..5 uniques
 *  et triés. Liste absente/vide → [1] (cohérent avec le web). */
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

/** Numéros de paliers requis par une sollicitation. Préfère la liste complète
 *  `tiers` (1..5) ; retombe sur le palier le plus haut `tier`, puis [1].
 *  Miroir de `relationRequiredTiers` (web Prospect.jsx). */
export function relationRequiredTierNums(rel: {
  tiers?: number[] | null;
  tier?: number | null;
}): number[] {
  if (rel && Array.isArray(rel.tiers) && rel.tiers.length > 0) {
    return normalizeRequiredTierNums(rel.tiers);
  }
  if (rel && rel.tier) return [rel.tier];
  return [1];
}

/** true si TOUS les champs requis du palier sont renseignés dans `row`. */
export function isTierComplete(
  tier: TierKey,
  row: Record<string, unknown> | null | undefined,
): boolean {
  if (!row) return false;
  return REQUIRED_TIER_FIELDS[tier].every((col) => isFilled(row[col]));
}

/** Renvoie les numéros de paliers requis qui ne sont PAS intégralement
 *  renseignés dans la réponse `/api/prospect/donnees`. Un palier
 *  masqué/supprimé (row null) est considéré incomplet (le serveur applique le
 *  même garde-fou sur les rows réelles). */
export function missingRequiredTierNums(
  requiredTierNums: number[],
  donnees: DonneesResp | null | undefined,
): number[] {
  const nums =
    Array.isArray(requiredTierNums) && requiredTierNums.length > 0
      ? requiredTierNums
      : [1];
  if (!donnees) return nums;
  return nums.filter((num) => {
    const key = TIER_NUM_TO_KEY[num];
    if (!key) return false;
    const row = donnees[key] as Record<string, unknown> | null;
    return !isTierComplete(key, row);
  });
}
