/**
 * SDK Stripe côté serveur — initialisation paresseuse.
 *
 * Le client n'est créé qu'à la première utilisation, pas à l'import. Ça évite
 * que `next build` plante quand `STRIPE_SECRET_KEY` n'est pas (encore)
 * configuré dans l'environnement de build (typiquement Vercel avant qu'on ait
 * créé le compte Stripe).
 *
 * Usage :
 *   import { getStripe } from "@/lib/stripe/server";
 *   const stripe = getStripe();
 *   await stripe.checkout.sessions.create(...);
 */

import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY manquant. Ajoute-le dans .env.local (dev) ou dans les Project Settings → Environment Variables (Vercel).",
    );
  }
  cached = new Stripe(key, { typescript: true });
  return cached;
}
