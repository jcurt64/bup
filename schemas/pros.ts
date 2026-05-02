/**
 * Compte professionnel — entreprise/indépendant qui lance des campagnes
 * de mise en relation et paie au contact accepté.
 */

export type ProPlan = "starter" | "pro";

export type ProBillingStatus = "active" | "past_due" | "canceled" | "trialing";

export type ProAccount = {
  id: string;
  clerkUserId: string;
  raisonSociale: string;
  /** SIREN sur 9 chiffres (validation côté DB). */
  siren: string | null;
  secteur: string;
  /** Adresse + ville utilisées pour le ciblage géographique des campagnes. */
  adresse: string;
  ville: string;
  codePostal: string;
  /** Stripe customer rattaché (créé au premier paiement). */
  stripeCustomerId: string | null;
  plan: ProPlan;
  billingStatus: ProBillingStatus;
  /** Solde de crédits restants (centimes d'€). */
  walletBalanceCents: number;
  createdAt: string;
  updatedAt: string;
};
