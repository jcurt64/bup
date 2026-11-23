/**
 * Mapping wizard ↔ DB pour la création de campagne.
 *
 * Source de vérité côté UI : `OBJECTIVES`, `VERIF_LEVELS` dans
 * `public/prototype/components/Pro.jsx`.
 *
 * Comme le wizard est en JSX dans une iframe (pas typé), ces mappings
 * sont la frontière où l'on valide et convertit avant de toucher la DB.
 */

import type { Database } from "@/lib/supabase/types";

export type CampaignTypeDb = Database["public"]["Enums"]["campaign_type"];
export type VerificationLevelDb = Database["public"]["Enums"]["verification_level"];

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

/**
 * Pivot « mise en relation pure » : les paliers de données, le ciblage
 * géographique et le ciblage par âge ont été supprimés. Seul subsiste le
 * palier 1 (prénom + initiale + téléphone transmis après acceptation /
 * e-mail relayé par BUUPP).
 */
export const CONTACT_ONLY_TIER_KEYS = ["identity"] as const;
