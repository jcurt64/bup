/**
 * POST /api/stripe/checkout — recharge du portefeuille pro.
 *
 * Crée (ou récupère) le Stripe Customer rattaché au pro, puis génère une
 * Checkout Session en mode `payment` pour le montant demandé. Le webhook
 * `/api/stripe/webhook` consommera l'événement `checkout.session.completed`
 * pour créditer `pro_accounts.wallet_balance_cents` et tracer la transaction.
 *
 * Body : { amountCents: number }   (50 € minimum, 10 000 € maximum)
 * Réponse : { url } à utiliser pour rediriger côté client.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

// Force dynamique : pas d'analyse statique au build → SDK Stripe chargé
// uniquement à la première requête.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_TOPUP_CENTS = 50_00; // 50 €
const MAX_TOPUP_CENTS = 10_000_00; // 10 000 €

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    amountCents?: number;
  };
  const amountCents = Number(body.amountCents);
  if (
    !Number.isFinite(amountCents) ||
    amountCents < MIN_TOPUP_CENTS ||
    amountCents > MAX_TOPUP_CENTS
  ) {
    return NextResponse.json(
      {
        error: "invalid_amount",
        message: `Montant invalide (entre ${MIN_TOPUP_CENTS / 100} € et ${MAX_TOPUP_CENTS / 100} €).`,
      },
      { status: 400 },
    );
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;

  // Garantit l'existence de la row pro_accounts (idempotent).
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const { data: pro } = await admin
    .from("pro_accounts")
    .select("id, raison_sociale, stripe_customer_id")
    .eq("id", proId)
    .single();

  const stripe = await getStripe();

  // Création paresseuse du Customer Stripe : 1 par compte pro, réutilisé
  // entre tous les rechargements / reçus / abonnements futurs.
  let stripeCustomerId = pro?.stripe_customer_id ?? null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      name: pro?.raison_sociale ?? undefined,
      metadata: { clerkUserId: userId, proAccountId: proId },
    });
    stripeCustomerId = customer.id;
    await admin
      .from("pro_accounts")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", proId);
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
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
    success_url: `${appUrl}/pro?topup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pro?topup=canceled`,
    // Tags arbitraires — repris dans le webhook pour cibler la bonne row
    // pro_accounts et créditer le bon montant sans re-faire un round-trip.
    metadata: {
      clerkUserId: userId,
      proAccountId: proId,
      kind: "topup",
      amountCents: String(amountCents),
    },
  });

  return NextResponse.json({ url: session.url });
}
