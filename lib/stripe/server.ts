/**
 * SDK Stripe côté serveur — singleton réutilisé par toutes les
 * route handlers et server actions.
 */

import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // On laisse Stripe choisir la version via la valeur "verrouillée" dans le
  // dashboard. Pinner ici n'apporte rien et complique les upgrades.
  typescript: true,
});
