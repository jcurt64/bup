/**
 * Domaines d'activité — liste UNIQUE partagée pro ↔ prospect.
 *
 *   • Pro (étape 6 de la création de campagne, ex-« mots-clés ») : précise
 *     jusqu'à 2 domaines, ou « Tous » (= liste vide). Affichés sur l'annonce.
 *   • Prospect (Préférences) : choisit le ou les domaines dans lesquels il
 *     accepte d'être sollicité, ou « Tous » (`prospects.all_categories`).
 *     Stockés dans `prospects.categories` (libellés).
 *
 * Matching (lib/campaigns/matching.ts) : une campagne avec domaines ne
 * sollicite que les prospects « Tous » OU ayant au moins un domaine commun.
 *
 * ⚠ Miroir exact de ACTIVITY_DOMAINS dans public/prototype/components/
 *   Pro.jsx et CATEGORY_LIST dans Prospect.jsx. Les 11 premiers libellés
 *   sont les anciennes « catégories » prospect (préférences existantes
 *   conservées telles quelles) — ne jamais les renommer.
 */
export const ACTIVITY_DOMAINS = [
  "Bien-être",
  "Coaching",
  "Artisanat",
  "Immobilier",
  "Finance",
  "Assurance",
  "Auto",
  "Éducation",
  "Beauté",
  "Alimentation",
  "Juridique",
  "Santé",
  "Énergie",
  "Maison & jardin",
  "Mode",
  "Loisirs & voyages",
  "High-tech & télécom",
  "Services à la personne",
] as const;

export const MAX_CAMPAIGN_DOMAINS = 2;

const DOMAIN_SET = new Set<string>(ACTIVITY_DOMAINS);

/** Entrée client → domaines valides, dédoublonnés, ≤ 2. [] = « Tous ». */
export function parseCampaignDomains(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || !DOMAIN_SET.has(v) || out.includes(v)) continue;
    out.push(v);
    if (out.length >= MAX_CAMPAIGN_DOMAINS) break;
  }
  return out;
}

/** Lecture défensive depuis `campaigns.targeting`. */
export function readCampaignDomains(targeting: unknown): string[] {
  if (!targeting || typeof targeting !== "object") return [];
  return parseCampaignDomains((targeting as { domains?: unknown }).domains);
}

/** Valeur PostgREST d'un tableau texte : {"A","B"} (guillemets échappés). */
export function pgTextArrayLiteral(values: readonly string[]): string {
  return `{${values.map((v) => `"${v.replace(/["\\]/g, "\\$&")}"`).join(",")}}`;
}
