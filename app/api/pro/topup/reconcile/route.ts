/**
 * POST /api/pro/topup/reconcile
 *
 * Filet de sécurité quand le webhook Stripe n'atteint pas le serveur
 * (cas typique : dev local sans `stripe listen`, restart serveur après
 * paiement, restriction réseau). Appelé par la page /pro après le
 * retour de Checkout (`?topup=success&session_id=...`) :
 *
 *   1. Vérifie la session côté Stripe API (preuve cryptographique :
 *      seul Stripe peut renvoyer `payment_status = paid`).
 *   2. Vérifie l'ownership : `metadata.proAccountId` doit appartenir
 *      au user Clerk authentifié.
 *   3. Idempotence : si une transaction `topup` existe déjà pour ce
 *      payment_intent, on no-op (le webhook a déjà tourné, ou un
 *      reconcile précédent).
 *   4. Sinon, on crédite le wallet + insère la transaction (même
 *      logique que le handler du webhook).
 *
 * Body : { sessionId: string }
 * Auth : session Clerk (le user doit être le propriétaire du proAccount).
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/clerk/server";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
  };
  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const stripe = await getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "stripe_retrieve_failed";
    return NextResponse.json(
      { error: "session_not_found", message: msg },
      { status: 404 },
    );
  }

  // Sécurité : la session doit être un topup BUUPP, payée, et appartenir
  // au user authentifié. Sans ces 3 checks, n'importe quel user pourrait
  // créditer un autre compte en passant un session_id arbitraire.
  if (session.metadata?.kind !== "topup") {
    return NextResponse.json({ error: "wrong_session_kind" }, { status: 400 });
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { error: "session_not_paid", paymentStatus: session.payment_status },
      { status: 409 },
    );
  }
  if (session.metadata?.clerkUserId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const proAccountId = session.metadata.proAccountId;
  const amountCents = Number(
    session.metadata.amountCents ?? session.amount_total ?? 0,
  );
  if (!proAccountId || !amountCents) {
    return NextResponse.json(
      { error: "invalid_metadata" },
      { status: 422 },
    );
  }

  const admin = createSupabaseAdminClient();
  const piId = (session.payment_intent as string) ?? session.id;

  // Idempotence : si la transaction existe déjà (webhook plus rapide,
  // ou reconcile précédent), on renvoie le statut sans rien refaire.
  const { data: existing } = await admin
    .from("transactions")
    .select("id")
    .eq("stripe_payment_intent_id", piId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, alreadyCredited: true });
  }

  // Crédite + trace en parallèle (même logique que le webhook).
  await admin.from("transactions").insert({
    account_id: proAccountId,
    account_kind: "pro",
    type: "topup",
    status: "completed",
    amount_cents: amountCents,
    stripe_payment_intent_id: piId,
    description: `Recharge BUUPP via Stripe (${(amountCents / 100).toFixed(2)} € crédités)`,
  });

  const { data: pro } = await admin
    .from("pro_accounts")
    .select("wallet_balance_cents")
    .eq("id", proAccountId)
    .single();
  if (pro) {
    await admin
      .from("pro_accounts")
      .update({
        wallet_balance_cents:
          Number(pro.wallet_balance_cents ?? 0) + amountCents,
      })
      .eq("id", proAccountId);
  }

  return NextResponse.json({ ok: true, alreadyCredited: false, amountCents });
}
