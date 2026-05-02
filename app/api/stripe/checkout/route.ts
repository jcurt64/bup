/**
 * POST /api/stripe/checkout
 *
 * Crée une Stripe Checkout Session pour qu'un pro recharge son
 * portefeuille. Le succès renvoie un `url` que le front utilise
 * pour rediriger l'utilisateur vers le tunnel Stripe hébergé.
 *
 * Body attendu : { amountCents: number, plan?: "starter" | "pro" }
 *
 * Implémentation à compléter quand les pricing IDs Stripe seront créés.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { auth } from "@/lib/clerk/server";

// Force le runtime dynamique → Next.js n'essaie pas de pré-générer / pré-analyser
// la route au build, ce qui éviterait toute évaluation prématurée du SDK Stripe.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { amountCents } = (await request.json()) as { amountCents: number };

  const stripe = await getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: "Recharge BUUPP" },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro?topup=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro?topup=canceled`,
    metadata: { clerkUserId: userId },
  });

  return NextResponse.json({ url: session.url });
}
