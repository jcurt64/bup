/**
 * Rémunération d'une mise en relation — pivot « mise en relation pure »
 * (nov. 2026) : il n'existe plus qu'un seul tarif de base, 1,00 € par contact
 * accepté (prénom + initiale + coordonnées relayées par BUUPP), multiplié
 * côté wizard par le niveau de vérification exigé (p0 ×1, p1 ×1,5, p2 ×2)
 * puis par la durée (1h ×3, 24h ×2, 48h ×1,5, 7j ×1). Le ×2 « certifié
 * confiance » s'applique ensuite à chaque relation.
 *
 * Validation serveur : POST /api/pro/campaigns.
 */

/** Tarif de base d'un contact, en cents (1,00 €). */
export const CONTACT_BASE_REWARD_CENTS = 100;

/** Compat : seul le palier 1 subsiste. */
export type TierNum = 1;

export type TierReward = {
  tier: TierNum;
  key: "identity";
  minCents: number;
  maxCents: number;
  rangeLabel: string;
};

export const TIER_REWARDS: Record<TierNum, TierReward> = {
  1: {
    tier: 1,
    key: "identity",
    minCents: CONTACT_BASE_REWARD_CENTS,
    maxCents: CONTACT_BASE_REWARD_CENTS,
    rangeLabel: "minimum 1,00 €",
  },
};

export const TIER_NUMS: TierNum[] = [1];

/** Compat : la borne est toujours celle du palier 1, quelle que soit l'entrée. */
export function rangeForRequiredTiers(
  _requiredTiers: readonly unknown[] = [],
): { minCents: number; maxCents: number; tier: TierNum } {
  void _requiredTiers;
  const r = TIER_REWARDS[1];
  return { minCents: r.minCents, maxCents: r.maxCents, tier: 1 };
}
