/**
 * Commission BUUPP — règle unique de tarification (formule unique, sans
 * frais d'accès).
 *
 * Par acceptation, BUUPP perçoit 10 % de la rémunération du prospect, avec
 * un PLANCHER de 0,30 € : on retient le plus élevé des deux montants.
 *
 *   rémunération  10 %    commission   le pro paie
 *   1,00 €        0,10 €  0,30 €       1,30 €
 *   3,00 €        0,30 €  0,30 €       3,30 €
 *   5,00 €        0,50 €  0,50 €       5,50 €
 *  10,00 €        1,00 €  1,00 €      11,00 €
 *
 * La base est la rémunération RÉELLEMENT versée au prospect (×2 certifié
 * confiance et multiplicateur de durée inclus), bonus parrain EXCLU.
 *
 * ⚠️ Miroir SQL : `public.buupp_commission_cents(reward, rate_bp, floor)`
 * (migration 20261106120000_commission_floor_single_plan.sql). Les deux
 * doivent rester identiques — c'est la RPC SQL qui débite réellement.
 * Le tarif est figé sur chaque campagne à sa création
 * (`campaigns.commission_rate_bp` / `commission_floor_cents`).
 */

/** Taux en points de base (1000 = 10 %). */
export const COMMISSION_RATE_BP = 1000;
/** Plancher par acceptation, en centimes (30 = 0,30 €). */
export const COMMISSION_FLOOR_CENTS = 30;

/**
 * Commission (centimes) due pour UNE acceptation dont la rémunération
 * prospect vaut `rewardCents`. Arrondi au centime le plus proche (demi
 * vers le haut). Rémunération nulle/négative → 0 (pas d'acceptation payée).
 */
export function commissionCents(
  rewardCents: number,
  rateBp: number = COMMISSION_RATE_BP,
  floorCents: number = COMMISSION_FLOOR_CENTS,
): number {
  const reward = Math.round(Number(rewardCents) || 0);
  if (reward <= 0) return 0;
  const pct = Math.floor((reward * rateBp + 5000) / 10000);
  return Math.max(floorCents, pct);
}

/**
 * Commission MAXIMALE d'une campagne (réservée au lancement) : chaque
 * contact payé au coût par contact du wizard accepte.
 */
export function campaignCommissionMaxCents(
  contacts: number,
  costPerContactCents: number,
  rateBp: number = COMMISSION_RATE_BP,
  floorCents: number = COMMISSION_FLOOR_CENTS,
): number {
  const n = Math.max(0, Math.floor(Number(contacts) || 0));
  return n * commissionCents(costPerContactCents, rateBp, floorCents);
}

/** Libellé court réutilisable dans l'UI / les PDF. */
export const COMMISSION_LABEL = "10 % de la rémunération, min. 0,30 € par acceptation";
