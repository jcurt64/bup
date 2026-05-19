/**
 * POST /api/stripe/setup — Checkout Session `mode:'setup'` pour
 * enregistrer une carte (0 €, aucun paiement). Au retour, le webhook
 * (`checkout.session.completed`, mode setup) + le reconcile persistent
 * `stripe_default_payment_method_id`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { getStripe } from "@/lib/stripe/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { ensureStripeCustomer } from "@/lib/stripe/customer";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;

  const proId = await ensureProAccount({ clerkUserId: userId, email });

  try {
    const customer = await ensureStripeCustomer({
      proId,
      clerkUserId: userId,
      email,
    });
    const stripe = await getStripe();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer,
      payment_method_types: ["card"],
      success_url: `${appUrl}/pro?card_setup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pro?card_setup=cancel`,
      metadata: {
        kind: "card_setup",
        proAccountId: proId,
        clerkUserId: userId,
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "stripe_failed";
    console.error("[/api/stripe/setup] échec :", msg);
    return NextResponse.json({ error: "stripe_failed" }, { status: 502 });
  }
}
