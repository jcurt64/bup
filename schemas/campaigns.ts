/**
 * Campagne lancée par un pro — ciblage par paliers + budget +
 * objectif (prise de contact / RDV / devis).
 */

import type { CampaignType } from "./prospects";
import type { TierId } from "./tiers";

export type CampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "canceled";

export type CampaignTargeting = {
  /** Paliers requis chez le prospect pour matcher (1..5). */
  requiredTiers: TierId[];
  /** Code postaux ou départements ciblés ("69003", "33", "national"). */
  geo: string[];
  /** Filtres sectoriels libres ("Bien-être", "Artisanat"…). */
  categories: string[];
  /** BUPP Score minimum requis. */
  minScore: number;
};

export type Campaign = {
  id: string;
  proAccountId: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  targeting: CampaignTargeting;
  /** Coût payé par le pro à chaque acceptation (centimes d'€). */
  costPerContactCents: number;
  /** Budget plafond total (centimes d'€). */
  budgetCents: number;
  /** Total déjà dépensé (centimes d'€). */
  spentCents: number;
  /** Date de fin (ISO) — la campagne s'auto-clôture passé ce point. */
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};
