/**
 * Loader Stripe.js pour les Client Components qui ont besoin de
 * `Stripe Elements`, `redirectToCheckout`, etc. Le loader cache
 * le résultat → un seul script Stripe injecté dans la page.
 */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    );
  }
  return stripePromise;
}
