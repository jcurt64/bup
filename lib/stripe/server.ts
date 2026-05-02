/**
 * SDK Stripe côté serveur — initialisation paresseuse + import dynamique.
 *
 * Le SDK n'est NI importé NI instancié à l'évaluation du module : on
 * `await import("stripe")` à la première utilisation seulement. Ça blinde
 * le build Next.js / Turbopack contre toute analyse statique qui chercherait
 * à évaluer `new Stripe(undefined)` quand la clé n'est pas (encore) en env.
 *
 * Usage :
 *   const stripe = await getStripe();
 *   await stripe.checkout.sessions.create(...);
 */

import type Stripe from "stripe";

let cached: Stripe | null = null;

export async function getStripe(): Promise<Stripe> {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY manquant. Ajoute-le dans .env.local (dev) ou dans les Project Settings → Environment Variables (Vercel).",
    );
  }

  // Import dynamique → la lib `stripe` n'est chargée qu'à la 1re requête,
  // jamais à l'évaluation du chunk durant `next build`.
  const { default: StripeCtor } = await import("stripe");
  cached = new StripeCtor(key, { typescript: true });
  return cached;
}
