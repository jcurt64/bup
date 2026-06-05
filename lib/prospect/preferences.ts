/**
 * Préférences de monétisation du prospect (onglet « Préférences »).
 *
 * Frontière de conversion entre le modèle UI (libellés affichés dans
 * `public/prototype/components/Prospect.jsx`) et la row `prospects`.
 *
 * Subtilité « Types de campagne » : l'UI expose 6 libellés à la granularité
 * OBJECTIF, alors que l'enum DB `campaign_type` n'a que 4 valeurs. On stocke
 * donc les libellés bruts dans `campaign_objectives` (restitution fidèle au
 * reload) ET on projette vers l'enum `campaign_types` (utilisé par le
 * matching — cf. lib/campaigns/matching.ts).
 *
 * ⚠ CAMPAIGN_TYPE_LABELS / CATEGORY_LABELS sont le miroir exact de
 *   CAMPAIGN_TYPE_LIST / CATEGORY_LIST côté prototype : tenir synchronisé.
 */

import type { Database } from "@/lib/supabase/types";

export type CampaignTypeDb = Database["public"]["Enums"]["campaign_type"];

export const CAMPAIGN_TYPE_LABELS = [
  "Prise de contact",
  "Prise de rendez-vous",
  "Événement",
  "Téléchargement",
  "Enquête & avis",
  "Promotion",
] as const;

export const CATEGORY_LABELS = [
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
] as const;

/** Libellé UI (objectif) → valeur enum DB. Plusieurs libellés peuvent
 *  retomber sur le même enum (collapse 6 → 4), cohérent avec la table
 *  OBJECTIVE_TO_TYPE de lib/campaigns/mapping.ts. */
const LABEL_TO_CAMPAIGN_TYPE: Record<string, CampaignTypeDb> = {
  "Prise de contact": "prise_de_contact",
  "Prise de rendez-vous": "prise_de_rendez_vous",
  "Événement": "prise_de_contact",
  "Téléchargement": "prise_de_contact",
  "Enquête & avis": "information_sondage",
  "Promotion": "prise_de_contact",
};

const CAMPAIGN_TYPE_SET = new Set<string>(CAMPAIGN_TYPE_LABELS);
const CATEGORY_SET = new Set<string>(CATEGORY_LABELS);

/** Filtre une entrée client contre une whitelist de libellés : ne garde que
 *  les chaînes connues, dédoublonne, conserve l'ordre, borne à `max`. */
function sanitizeAgainst(input: unknown, allowed: Set<string>, max: number): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    if (!allowed.has(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

export function sanitizeCampaignTypeLabels(input: unknown): string[] {
  return sanitizeAgainst(input, CAMPAIGN_TYPE_SET, CAMPAIGN_TYPE_LABELS.length);
}

export function sanitizeCategoryLabels(input: unknown): string[] {
  return sanitizeAgainst(input, CATEGORY_SET, CATEGORY_LABELS.length);
}

/** Projette des libellés UI vers l'enum DB (dédoublonné). */
export function campaignLabelsToEnum(labels: string[]): CampaignTypeDb[] {
  const seen = new Set<CampaignTypeDb>();
  const out: CampaignTypeDb[] = [];
  for (const l of labels) {
    const e = LABEL_TO_CAMPAIGN_TYPE[l];
    if (e && !seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  }
  return out;
}

export type PreferencesInput = {
  allCampaignTypes?: unknown;
  campaignTypes?: unknown;
  allCategories?: unknown;
  categories?: unknown;
};

export type PreferencesRowPatch = {
  all_campaign_types?: boolean;
  campaign_objectives?: string[];
  campaign_types?: CampaignTypeDb[];
  all_categories?: boolean;
  categories?: string[];
};

/** UI → patch row `prospects`. Ne retient que les champs présents et bien
 *  typés (anti mass-assignment). Pour les types de campagne, écrit à la fois
 *  les libellés (campaign_objectives, fidélité UI) et l'enum projeté
 *  (campaign_types, matching). */
export function buildPreferencesPatch(input: PreferencesInput): PreferencesRowPatch {
  const patch: PreferencesRowPatch = {};
  if (typeof input.allCampaignTypes === "boolean") {
    patch.all_campaign_types = input.allCampaignTypes;
  }
  if (input.campaignTypes !== undefined) {
    const labels = sanitizeCampaignTypeLabels(input.campaignTypes);
    patch.campaign_objectives = labels;
    patch.campaign_types = campaignLabelsToEnum(labels);
  }
  if (typeof input.allCategories === "boolean") {
    patch.all_categories = input.allCategories;
  }
  if (input.categories !== undefined) {
    patch.categories = sanitizeCategoryLabels(input.categories);
  }
  return patch;
}

export type UiPreferences = {
  allCampaignTypes: boolean;
  campaignTypes: string[];
  allCategories: boolean;
  categories: string[];
};

type PreferencesRow = {
  all_campaign_types?: boolean | null;
  campaign_objectives?: string[] | null;
  all_categories?: boolean | null;
  categories?: string[] | null;
};

/** Row `prospects` → préférences UI. Modèle opt-out : tout champ absent /
 *  null ⇒ « tout accepté » (cohérent avec les DEFAULT true côté DB). */
export function rowToPreferences(row: PreferencesRow | null): UiPreferences {
  return {
    allCampaignTypes: row?.all_campaign_types !== false,
    campaignTypes: sanitizeCampaignTypeLabels(row?.campaign_objectives ?? []),
    allCategories: row?.all_categories !== false,
    categories: sanitizeCategoryLabels(row?.categories ?? []),
  };
}
