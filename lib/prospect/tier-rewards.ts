/**
 * Grille de rémunération par palier — source de vérité unique pour :
 *   - le rendu UI (home page TIERS, page /bareme, prototype Landing/Prospect, waitlist)
 *   - la validation backend du cost_per_contact_cents lors de la création
 *     d'une campagne (cf. POST /api/pro/campaigns).
 *
 * Convention : `min === max` signifie un prix fixe ("minimum X €" côté UI).
 * Le palier 1 est le seul dans ce cas (1 € pile). Pour les paliers 2-5 le
 * pro choisit librement dans la fourchette.
 */
import type { TierKey } from "./donnees";

export type TierNum = 1 | 2 | 3 | 4 | 5;

export type TierReward = {
  tier: TierNum;
  /** Clé palier "donnees" associée — utile pour les jointures. */
  key: TierKey;
  /** Borne basse en cents (inclusive). */
  minCents: number;
  /** Borne haute en cents (inclusive). */
  maxCents: number;
  /** Libellé fr-FR pour l'affichage dans la grille de rémunération. */
  rangeLabel: string;
};

export const TIER_REWARDS: Record<TierNum, TierReward> = {
  1: { tier: 1, key: "identity",     minCents: 100,  maxCents: 100,  rangeLabel: "minimum 1,00 €" },
  2: { tier: 2, key: "localisation", minCents: 100,  maxCents: 200,  rangeLabel: "1,00 € – 2,00 €" },
  3: { tier: 3, key: "vie",          minCents: 200,  maxCents: 350,  rangeLabel: "2,00 € – 3,50 €" },
  4: { tier: 4, key: "pro",          minCents: 350,  maxCents: 500,  rangeLabel: "3,50 € – 5,00 €" },
  5: { tier: 5, key: "patrimoine",   minCents: 500,  maxCents: 1000, rangeLabel: "5,00 € – 10,00 €" },
};

export const TIER_NUMS: TierNum[] = [1, 2, 3, 4, 5];

function asTierNum(x: unknown): TierNum | null {
  const n = Number(x);
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5 ? (n as TierNum) : null;
}

/** Pour un set de paliers requis, renvoie la borne du palier le plus
 *  élevé — c'est lui qui dicte la rémunération côté prospect. */
export function rangeForRequiredTiers(
  requiredTiers: readonly unknown[],
): { minCents: number; maxCents: number; tier: TierNum } | null {
  const tiers = requiredTiers
    .map(asTierNum)
    .filter((t): t is TierNum => t !== null);
  if (tiers.length === 0) return null;
  const max = Math.max(...tiers) as TierNum;
  const r = TIER_REWARDS[max];
  return { minCents: r.minCents, maxCents: r.maxCents, tier: max };
}
