/**
 * POST /api/pro/wallet/payment-method/reconcile
 *
 * Filet de sécurité au retour de Checkout `mode:'setup'`
 * (`?card_setup=success&session_id=...`) si le webhook tarde. Vérifie
 * la session Stripe (preuve : seul Stripe renvoie une session setup
 * complétée), l'ownership (`metadata.clerkUserId` == user authentifié),
 * puis persiste `stripe_default_payment_method_id` (idempotent).
 *
 * Body : { sessionId: string }
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
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent"],
    });

    if (
      session.metadata?.kind !== "card_setup" ||
      session.mode !== "setup" ||
      session.metadata?.clerkUserId !== userId ||
      session.status !== "complete"
    ) {
      return NextResponse.json({ ok: false });
    }

    const proAccountId = session.metadata.proAccountId;
    const si = session.setup_intent;
    const pmId =
      si && typeof si === "object"
        ? typeof si.payment_method === "string"
          ? si.payment_method
          : (si.payment_method?.id ?? null)
        : null;
    if (!proAccountId || !pmId) {
      return NextResponse.json({ ok: false });
    }

    const admin = createSupabaseAdminClient();
    await admin
      .from("pro_accounts")
      .update({ stripe_default_payment_method_id: pmId })
      .eq("id", proAccountId);

    const pm = await stripe.paymentMethods.retrieve(pmId);
    const card = pm.card
      ? {
          brand: pm.card.brand ?? null,
          last4: pm.card.last4 ?? null,
          expMonth: pm.card.exp_month ?? null,
          expYear: pm.card.exp_year ?? null,
        }
      : null;
    return NextResponse.json({ ok: true, card });
  } catch (err) {
    console.error(
      "[/api/pro/wallet/payment-method/reconcile] échec :",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ ok: false });
  }
}
