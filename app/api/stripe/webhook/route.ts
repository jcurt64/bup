/**
 * POST /api/stripe/webhook
 *
 * Endpoint signé par Stripe — vérifie la signature, dispatche les
 * événements (checkout.session.completed, payment_intent.failed…)
 * vers le bon handler métier qui met à jour Supabase.
 *
 * À configurer dans le dashboard Stripe :
 *   Developers → Webhooks → Add endpoint → <APP_URL>/api/stripe/webhook
 */

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const payload = await request.text(); // raw body requis pour la vérification

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      // TODO: créditer le wallet pro depuis le metadata.clerkUserId
      break;
    case "payment_intent.payment_failed":
      // TODO: notifier le pro + log
      break;
    default:
      // Événement non géré — on ACK pour éviter les retries Stripe
      break;
  }

  return NextResponse.json({ received: true });
}
