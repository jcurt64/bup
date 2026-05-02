/**
 * Paliers de données BUUPP — la grille de monétisation est figée par produit.
 * Ces valeurs ne vivent pas en base : elles sont la référence partagée par
 * front et back pour calculer rémunérations / coûts campagne.
 */

export type TierId = 1 | 2 | 3 | 4 | 5;

export type TierKey = "identity" | "localisation" | "vie" | "pro" | "patrimoine";

export type Tier = {
  id: TierId;
  key: TierKey;
  name: string;
  description: string;
  /** Borne basse de la fourchette de rémunération prospect (€). */
  rewardLow: number;
  /** Borne haute de la fourchette de rémunération prospect (€). */
  rewardHigh: number;
};

export const TIERS: readonly Tier[] = [
  {
    id: 1,
    key: "identity",
    name: "Identification",
    description: "email, nom, téléphone, date de naissance",
    rewardLow: 0.1,
    rewardHigh: 0.5,
  },
  {
    id: 2,
    key: "localisation",
    name: "Localisation",
    description: "adresse, logement, mobilité",
    rewardLow: 0.5,
    rewardHigh: 1.0,
  },
  {
    id: 3,
    key: "vie",
    name: "Style de vie",
    description: "habitudes, famille, véhicule",
    rewardLow: 1.0,
    rewardHigh: 2.0,
  },
  {
    id: 4,
    key: "pro",
    name: "Données professionnelles",
    description: "poste, revenus, statut, secteur",
    rewardLow: 2.0,
    rewardHigh: 4.0,
  },
  {
    id: 5,
    key: "patrimoine",
    name: "Patrimoine & projets",
    description: "immobilier, épargne, projets",
    rewardLow: 4.0,
    rewardHigh: 8.0,
  },
] as const;
