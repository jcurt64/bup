/**
 * GET  /api/pro/wallet/auto-recharge
 *   → état de la recharge auto pour le pro courant.
 *
 * PATCH /api/pro/wallet/auto-recharge
 *   → mise à jour des paramètres (activation/désactivation/seuil/montant).
 *   Body : { enabled?: boolean, thresholdCents?: number, amountCents?: number }
 *
 *   ⚠️ Pour ACTIVER la recharge auto pour la première fois (ou quand le
 *   PM est expiré), le pro doit passer par /api/stripe/checkout avec
 *   `enableAutoRecharge=true` afin de sauvegarder un moyen de paiement
 *   (`setup_future_usage='off_session'`). Cet endpoint refuse l'activation
 *   si aucun PM n'est sauvegardé.
 *
 * Pour DÉSACTIVER ou modifier seuil/montant, pas besoin de repasser par
 * Stripe — on update directement la row pro_accounts.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import type { Database } from "@/lib/supabase/types";

type ProUpdate = Database["public"]["Tables"]["pro_accounts"]["Update"];

export const runtime = "nodejs";

const MIN_THRESHOLD_CENTS = 1000;     // 10 €
const MAX_THRESHOLD_CENTS = 1_000_000; // 10 000 €
const MIN_AMOUNT_CENTS = 5000;        // 50 €
const MAX_AMOUNT_CENTS = 1_000_000;   // 10 000 €

async function getProId(): Promise<{ proId: string } | NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  return { proId: await ensureProAccount({ clerkUserId: userId, email }) };
}

export async function GET() {
  const got = await getProId();
  if (got instanceof NextResponse) return got;
  const { proId } = got;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("pro_accounts")
    .select(
      `auto_recharge_enabled, auto_recharge_threshold_cents,
       auto_recharge_amount_cents, stripe_default_payment_method_id,
       auto_recharge_last_triggered_at, auto_recharge_last_failed_at,
       auto_recharge_last_failure_reason`,
    )
    .eq("id", proId)
    .single();
  if (error) {
    console.error("[/api/pro/wallet/auto-recharge GET] failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  return NextResponse.json({
    enabled: data.auto_recharge_enabled,
    thresholdCents: data.auto_recharge_threshold_cents,
    amountCents: data.auto_recharge_amount_cents,
    hasPaymentMethod: !!data.stripe_default_payment_method_id,
    lastTriggeredAt: data.auto_recharge_last_triggered_at,
    lastFailedAt: data.auto_recharge_last_failed_at,
    lastFailureReason: data.auto_recharge_last_failure_reason,
  });
}

export async function PATCH(req: Request) {
  const got = await getProId();
  if (got instanceof NextResponse) return got;
  const { proId } = got;

  let body: {
    enabled?: boolean;
    thresholdCents?: number;
    amountCents?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  // On lit l'état actuel pour valider l'activation (PM requis).
  const { data: current, error: readErr } = await admin
    .from("pro_accounts")
    .select("auto_recharge_enabled, stripe_default_payment_method_id")
    .eq("id", proId)
    .single();
  if (readErr) {
    console.error("[/api/pro/wallet/auto-recharge PATCH] read failed", readErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  // Si on tente d'activer alors qu'aucun PM n'est sauvegardé → on
  // refuse et on demande au pro de passer par Checkout.
  if (body.enabled === true && !current.stripe_default_payment_method_id) {
    return NextResponse.json(
      {
        error: "no_payment_method",
        message:
          "Pour activer la recharge automatique, effectuez d'abord une recharge manuelle en cochant la case « Recharge automatique » — votre moyen de paiement sera alors enregistré pour les recharges futures.",
      },
      { status: 400 },
    );
  }

  const update: ProUpdate = {};
  if (typeof body.enabled === "boolean") {
    update.auto_recharge_enabled = body.enabled;
  }
  if (typeof body.thresholdCents === "number") {
    if (
      body.thresholdCents < MIN_THRESHOLD_CENTS ||
      body.thresholdCents > MAX_THRESHOLD_CENTS
    ) {
      return NextResponse.json(
        {
          error: "invalid_threshold",
          message: `Seuil invalide : entre ${MIN_THRESHOLD_CENTS / 100} € et ${MAX_THRESHOLD_CENTS / 100} €.`,
        },
        { status: 400 },
      );
    }
    update.auto_recharge_threshold_cents = Math.round(body.thresholdCents);
  }
  if (typeof body.amountCents === "number") {
    if (
      body.amountCents < MIN_AMOUNT_CENTS ||
      body.amountCents > MAX_AMOUNT_CENTS
    ) {
      return NextResponse.json(
        {
          error: "invalid_amount",
          message: `Montant invalide : entre ${MIN_AMOUNT_CENTS / 100} € et ${MAX_AMOUNT_CENTS / 100} €.`,
        },
        { status: 400 },
      );
    }
    update.auto_recharge_amount_cents = Math.round(body.amountCents);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  const { error: upErr } = await admin
    .from("pro_accounts")
    .update(update)
    .eq("id", proId);
  if (upErr) {
    console.error("[/api/pro/wallet/auto-recharge PATCH] update failed", upErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
