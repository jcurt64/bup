/**
 * Mise en relation : sollicitation envoyée par une campagne à un prospect,
 * qui peut l'accepter, la refuser ou la laisser expirer (72h).
 */

export type RelationStatus =
  | "pending" // en attente de la décision du prospect
  | "accepted" // prospect a accepté → paiement en séquestre
  | "refused" // prospect a refusé → aucun débit
  | "expired" // 72h sans réponse → aucun débit
  | "settled"; // accepté + délai écoulé → fonds débloqués

export type Relation = {
  id: string;
  campaignId: string;
  proAccountId: string;
  prospectId: string;
  motif: string;
  /** Récompense brute prospect (centimes d'€). */
  rewardCents: number;
  status: RelationStatus;
  /** Date d'envoi de la sollicitation (ISO). */
  sentAt: string;
  /** Date limite de réponse (sentAt + 72h). */
  expiresAt: string;
  /** Date d'acceptation/refus (ISO). */
  decidedAt: string | null;
  /** Date de débit final pour le prospect (ISO). */
  settledAt: string | null;
};
