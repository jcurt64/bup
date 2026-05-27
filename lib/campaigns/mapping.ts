/**
 * Mapping wizard ↔ DB pour la création de campagne.
 *
 * Source de vérité côté UI : `OBJECTIVES`, `VERIF_LEVELS`, `AGE_RANGES`,
 * `GEO_ZONES` dans `public/prototype/components/Pro.jsx`.
 *
 * Comme le wizard est en JSX dans une iframe (pas typé), ces mappings
 * sont la frontière où l'on valide et convertit avant de toucher la DB.
 */

import type { Database } from "@/lib/supabase/types";

export type CampaignTypeDb = Database["public"]["Enums"]["campaign_type"];
export type VerificationLevelDb = Database["public"]["Enums"]["verification_level"];
export type TierKeyDb = Database["public"]["Enums"]["tier_key"];

const OBJECTIVE_TO_TYPE: Record<string, CampaignTypeDb> = {
  contact: "prise_de_contact",
  rdv: "prise_de_rendez_vous",
  evt: "prise_de_contact",
  dl: "prise_de_contact",
  survey: "information_sondage",
  promo: "prise_de_contact",
  addigital: "prise_de_contact",
};

export function objectiveToCampaignType(objectiveId: string): CampaignTypeDb {
  return OBJECTIVE_TO_TYPE[objectiveId] ?? "prise_de_contact";
}

const OBJECTIVE_TO_LABEL: Record<string, string> = {
  contact: "Prise de contact direct",
  rdv: "Prise de rendez-vous",
  evt: "Événementiel & inscription",
  dl: "Contenus à télécharger",
  survey: "Études & collecte d'avis",
  promo: "Promotions & fidélisation",
  addigital: "Publicité digitale",
};

export function objectiveLabel(objectiveId: string | null | undefined): string {
  if (!objectiveId) return "Campagne";
  return OBJECTIVE_TO_LABEL[objectiveId] ?? "Campagne";
}

/**
 * Sous-types valides par objectif — miroir de la liste `OBJECTIVES.sub`
 * du wizard (`public/prototype/components/Pro.jsx`). L'entrée 'autres'
 * est ajoutée à chaque objectif : elle permet au pro de cocher une
 * option fourre-tout quand aucun sous-type pré-défini ne convient
 * (le détail est alors précisé à l'étape Description).
 */
export const SUB_TYPES_BY_OBJECTIVE: Record<string, readonly string[]> = {
  contact: [
    "email", "sms", "mms", "postal", "phone", "wa", "pushweb", "pushapp", "autres",
  ],
  rdv: [
    "rdvphys", "rdvtel", "rdvvisio", "consult", "devis", "essai", "autres",
  ],
  evt: [
    "webinar", "portes", "atelier", "conf", "network", "demo", "launch", "tournoi", "autres",
  ],
  dl: [
    "wb", "etude", "cat", "guide", "info", "rapport", "tpl", "check", "replay", "autres",
  ],
  survey: [
    "csat", "nps", "poll", "panel", "test", "focus", "interview", "vote", "autres",
  ],
  promo: [
    "coupon", "welcome", "flash", "contest", "autres",
  ],
  addigital: [
    "meta", "google", "tiktok", "linkedin", "snap", "x", "autres",
  ],
};

/**
 * Garde-fou serveur : ne stocke que les sous-types reconnus pour
 * l'objectif demandé. Dédoublonne, conserve l'ordre d'entrée et
 * borne le résultat à 32 éléments (protection JSONB). Si l'objectif
 * est inconnu, retourne un tableau vide.
 */
export function filterValidSubTypes(
  objectiveId: string,
  subTypes: unknown,
): string[] {
  if (!Array.isArray(subTypes)) return [];
  const allowed = SUB_TYPES_BY_OBJECTIVE[objectiveId];
  if (!allowed) return [];
  const allowSet = new Set(allowed);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of subTypes) {
    if (typeof raw !== "string") continue;
    if (!allowSet.has(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= 32) break;
  }
  return out;
}

const VERIF_ACCEPTABLE: Record<string, VerificationLevelDb[]> = {
  p0: ["basique", "verifie", "certifie", "confiance", "certifie_confiance"],
  p1: ["verifie", "certifie", "confiance", "certifie_confiance"],
  p2: ["certifie", "confiance", "certifie_confiance"],
  p3: ["confiance", "certifie_confiance"],
};

export function acceptableVerifLevels(verif: string): VerificationLevelDb[] {
  return VERIF_ACCEPTABLE[verif] ?? VERIF_ACCEPTABLE.p0;
}

const TIER_NUM_TO_KEY: Record<number, TierKeyDb> = {
  1: "identity",
  2: "localisation",
  3: "vie",
  4: "pro",
  5: "patrimoine",
};

export function tierNumsToKeys(nums: number[] | null | undefined): TierKeyDb[] {
  if (!nums || nums.length === 0) return [];
  return nums
    .map((n) => TIER_NUM_TO_KEY[n])
    .filter((k): k is TierKeyDb => Boolean(k));
}

/**
 * Calcule un préfixe `LIKE` à appliquer sur `prospect_localisation.code_postal`
 * en fonction de la zone choisie par le pro et de son propre code postal.
 *
 * - 'ville'    → 2 premiers chiffres du CP du pro (ex. "69%"). Approximation
 *                département pour cette itération — un vrai rayon 20 km
 *                (TODO geo) demanderait une lib geocoding ou une table CP→GPS.
 * - 'dept'     → 2 premiers chiffres du CP du pro.
 * - 'region'   → idem 'dept' pour cette itération (mapping région complet
 *                out-of-scope).
 * - 'national' → null (pas de filtre).
 */
export function geoCodePostalPrefix(
  geo: string,
  proCodePostal: string | null,
): string | null {
  if (geo === "national") return null;
  if (!proCodePostal) return null;
  const dep = proCodePostal.slice(0, 2);
  if (geo === "ville" || geo === "dept" || geo === "region") {
    return dep + "%";
  }
  return null;
}

/**
 * Rayon minimum (km) que le prospect doit avoir activé dans ses Préférences
 * pour être éligible à une campagne de portée donnée. Cf. champ
 * `prospect_localisation.targeting_radius_km` (5-100 km, default 25).
 *
 * - 'ville'     → 25 km : couvre une agglomération, équivalent du
 *                 default prospect.
 * - 'dept'      → 50 km : ouverture département, prospect doit avoir
 *                 explicitement élargi sa zone.
 * - 'region'    → 100 km : couverture régionale.
 * - 'national'  → null   : pas de plancher (un prospect en zone
 *                 5 km reçoit aussi le national, c'est son choix
 *                 d'avoir paramétré ce minimum).
 */
export function geoRadiusFloorKm(geo: string): number | null {
  switch (geo) {
    case "ville":
      return 25;
    case "dept":
      return 50;
    case "region":
      return 100;
    case "national":
    default:
      return null;
  }
}

const AGE_BUCKETS: Record<string, [number, number]> = {
  "18–25": [18, 25],
  "26–35": [26, 35],
  "36–45": [36, 45],
  "46–55": [46, 55],
  "56–65": [56, 65],
  "65+": [65, 200],
};

/** Retourne null si `Tous` est dans la sélection (pas de filtre). */
export function ageRangesToBounds(
  ages: string[],
): Array<[number, number]> | null {
  if (!ages || ages.length === 0 || ages.includes("Tous")) return null;
  return ages
    .map((a) => AGE_BUCKETS[a])
    .filter((b): b is [number, number] => Boolean(b));
}

/** Calcule l'âge à partir d'une date de naissance string (`YYYY-MM-DD`). */
export function ageFromBirthString(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const birth = new Date(y, mo - 1, d);
  if (isNaN(birth.getTime())) return null;
  // Guard contre l'overflow silencieux du constructeur Date
  // (ex. "2001-02-29" devient "2001-03-01"). Rejette les dates invalides.
  if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== d) {
    return null;
  }
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const md = now.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function ageMatchesAny(
  age: number,
  bounds: Array<[number, number]>,
): boolean {
  return bounds.some(([lo, hi]) => age >= lo && age <= hi);
}
