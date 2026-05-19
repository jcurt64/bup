/**
 * Retourne le `stripe_customer_id` d'un pro, en créant le Customer
 * Stripe + le persistant s'il n'existe pas encore. 1 Customer par
 * compte pro, réutilisé (recharge, reçus, carte enregistrée).
 *
 * Logique reprise de app/api/stripe/checkout/route.ts (création inline)
 * pour rester DRY ; cette route n'est volontairement pas modifiée.
 */

import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function ensureStripeCustomer(opts: {
  proId: string;
  clerkUserId: string;
  email: string | null;
}): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data: pro } = await admin
    .from("pro_accounts")
    .select("id, raison_sociale, stripe_customer_id")
    .eq("id", opts.proId)
    .single();

  if (pro?.stripe_customer_id) return pro.stripe_customer_id;

  const stripe = await getStripe();
  const customer = await stripe.customers.create({
    email: opts.email ?? undefined,
    name: pro?.raison_sociale ?? undefined,
    metadata: { clerkUserId: opts.clerkUserId, proAccountId: opts.proId },
  });
  await admin
    .from("pro_accounts")
    .update({ stripe_customer_id: customer.id })
    .eq("id", opts.proId);
  return customer.id;
}
