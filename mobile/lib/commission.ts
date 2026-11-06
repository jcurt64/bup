// Commission BUUPP — miroir EXACT de `lib/pricing/commission.ts` (web).
//
// Par acceptation, BUUPP perçoit 10 % de la rémunération du prospect, avec
// un PLANCHER de 0,30 € : on retient le plus élevé des deux montants.
//   1 € → 0,30 € · 3 € → 0,30 € · 5 € → 0,50 € · 10 € → 1,00 €
// Le serveur reste la source de vérité (RPC SQL qui débite réellement) ;
// ceci ne sert qu'aux montants affichés avant lancement.

/** Taux en points de base (1000 = 10 %). */
export const COMMISSION_RATE_BP = 1000;
/** Plancher par acceptation, en centimes (30 = 0,30 €). */
export const COMMISSION_FLOOR_CENTS = 30;
/** Nombre max de contacts par campagne (formule unique). */
export const MAX_PROSPECTS_PER_CAMPAIGN = 500;

/** Commission (centimes) pour UNE acceptation de rémunération `rewardCents`
 *  — arrondi au centime le plus proche (demi vers le haut). */
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

/** Commission MAXIMALE d'une campagne (réservée au lancement) : chaque
 *  contact payé au coût par contact accepte. */
export function campaignCommissionMaxCents(
  contacts: number,
  costPerContactCents: number,
  rateBp: number = COMMISSION_RATE_BP,
  floorCents: number = COMMISSION_FLOOR_CENTS,
): number {
  const n = Math.max(0, Math.floor(Number(contacts) || 0));
  return n * commissionCents(costPerContactCents, rateBp, floorCents);
}

/** Libellé court réutilisable dans l'UI. */
export const COMMISSION_LABEL = "10 % de la rémunération, min. 0,30 € par acceptation";
