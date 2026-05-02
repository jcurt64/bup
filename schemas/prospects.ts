/**
 * Profil prospect — ce que l'utilisateur déclare.
 * Chaque palier est une table dédiée côté Supabase pour pouvoir
 * appliquer une RLS palier-par-palier (RGPD art.17 → suppression
 * possible d'un palier sans toucher aux autres).
 */

import type { TierKey } from "./tiers";

/** Niveau de vérification KYC de l'utilisateur. */
export type VerificationLevel =
  | "basique"
  | "verifie"
  | "certifie"
  | "confiance";

/** Type de campagne acceptée par le prospect. */
export type CampaignType =
  | "Prise de contact"
  | "Prise de rendez-vous"
  | "Information / sondage"
  | "Devis / chiffrage";

export type ProspectIdentity = {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  /** ISO 8601 (`YYYY-MM-DD`). */
  naissance: string | null;
};

export type ProspectLocalisation = {
  adresse: string;
  ville: string;
  codePostal: string;
  logement: string;
  mobilite: string;
};

export type ProspectVie = {
  foyer: string;
  sports: string;
  animaux: string;
  vehicule: string;
};

export type ProspectPro = {
  poste: string;
  statut: string;
  secteur: string;
  /** Tranche déclarative, pas un montant exact. */
  revenus: string;
};

export type ProspectPatrimoine = {
  residence: string;
  epargne: string;
  projets: string;
};

/** Préférences de monétisation du prospect. */
export type ProspectPreferences = {
  /** Si `true`, accepte tous les types de campagne. */
  allCampaignTypes: boolean;
  /** Sous-ensemble explicitement autorisé quand `allCampaignTypes = false`. */
  campaignTypes: CampaignType[];
  /** Catégories sectorielles autorisées (Bien-être, Artisanat…). */
  categories: string[];
};

/** Représentation côté API (assemblée à partir des tables paliers). */
export type ProspectProfile = {
  id: string; // UUID Supabase
  clerkUserId: string; // FK vers Clerk
  bupp_score: number; // 0–1000
  verification: VerificationLevel;
  /** Paliers permanently supprimés (RGPD art.17). */
  removedTiers: TierKey[];
  /** Paliers temporairement masqués (campagnes ne peuvent plus les exiger). */
  hiddenTiers: TierKey[];
  identity: ProspectIdentity | null;
  localisation: ProspectLocalisation | null;
  vie: ProspectVie | null;
  pro: ProspectPro | null;
  patrimoine: ProspectPatrimoine | null;
  preferences: ProspectPreferences;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
