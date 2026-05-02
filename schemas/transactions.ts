/**
 * Mouvements financiers — alimentent l'historique du portefeuille
 * côté prospect ET côté pro.
 */

export type TransactionType =
  | "credit" // crédité au prospect après acceptation + délai
  | "escrow" // mis en séquestre côté pro/prospect
  | "withdrawal" // retrait IBAN/carte cadeau prospect
  | "topup" // recharge stripe pro
  | "campaign_charge" // débit pro lors d'une acceptation
  | "referral_bonus"
  | "refund";

export type TransactionStatus = "pending" | "completed" | "failed" | "canceled";

export type Transaction = {
  id: string;
  /** Côté concerné : prospect.id OU proAccount.id (selon `accountKind`). */
  accountId: string;
  accountKind: "prospect" | "pro";
  type: TransactionType;
  status: TransactionStatus;
  /** Montant signé en centimes d'€ (positif = crédit, négatif = débit). */
  amountCents: number;
  /** Référence à une mise en relation, campagne ou paiement Stripe. */
  relationId: string | null;
  campaignId: string | null;
  stripePaymentIntentId: string | null;
  description: string;
  createdAt: string;
};
