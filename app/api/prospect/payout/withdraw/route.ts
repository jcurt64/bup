/**
 * POST /api/prospect/payout/withdraw
 *
 * Vire `amountCents` depuis le solde plateforme vers le compte Stripe
 * Connect Express du prospect. Insère immédiatement une transaction
 * `withdrawal` en `pending` ; le webhook Stripe la passe à `completed`
 * (ou `failed`) à réception de l'événement `transfer.paid` /
 * `transfer.failed`.
 *
 * Préconditions strictes :
 *   - Le prospect a un Connect account ET `payouts_enabled = true`
 *   - Le solde disponible (gains − retraits) ≥ amountCents
 *   - amountCents ≥ 5 € (limite produit, alignée avec /api/prospect/wallet)
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_WITHDRAW_CENTS = 5_00; // 5 €

const sumAmounts = (rows: { amount_cents: number | null }[] | null) =>
  (rows ?? []).reduce((acc, r) => acc + Number(r.amount_cents ?? 0), 0);

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    amountCents?: number;
    method?: string;
  };
  const amountCents = Number(body.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < MIN_WITHDRAW_CENTS) {
    return NextResponse.json(
      {
        error: "invalid_amount",
        message: `Montant invalide (minimum ${MIN_WITHDRAW_CENTS / 100} €).`,
      },
      { status: 400 },
    );
  }

  // Méthode de retrait. Pour l'instant seul `iban` (virement Stripe Connect
  // vers IBAN) est ouvert ; `card` (paiement instantané) et `gift` (cartes
  // cadeaux & dons) sont prévus mais désactivés en attendant l'intégration.
  // On rejette explicitement plutôt que d'ignorer pour éviter qu'un client
  // qui passerait une autre méthode pense qu'un autre flux a réussi.
  const method = (body.method ?? "iban").toString();
  if (method !== "iban") {
    return NextResponse.json(
      {
        error: "method_unavailable",
        message: "Ce mode de retrait n'est pas encore disponible.",
      },
      { status: 400 },
    );
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;

  const prospectId = await ensureProspect({
    clerkUserId: userId,
    email,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });

  const admin = createSupabaseAdminClient();
  const { data: prospect } = await admin
    .from("prospects")
    .select("stripe_connect_account_id, stripe_payouts_enabled")
    .eq("id", prospectId)
    .single();

  if (!prospect?.stripe_connect_account_id || !prospect.stripe_payouts_enabled) {
    return NextResponse.json(
      {
        error: "onboarding_required",
        message: "Onboarding Stripe non terminé.",
      },
      { status: 409 },
    );
  }

  // Vérifie le solde disponible avant le transfer pour éviter qu'un retrait
  // dépasse les gains. La table transactions est la source de vérité.
  const [creditRes, withdrawRes] = await Promise.all([
    admin
      .from("transactions")
      .select("amount_cents")
      .eq("account_kind", "prospect")
      .eq("account_id", prospectId)
      .in("type", ["credit", "referral_bonus"])
      .eq("status", "completed"),
    admin
      .from("transactions")
      .select("amount_cents")
      .eq("account_kind", "prospect")
      .eq("account_id", prospectId)
      .eq("type", "withdrawal")
      .in("status", ["pending", "completed"]),
  ]);
  const availableCents = sumAmounts(creditRes.data) - sumAmounts(withdrawRes.data);
  if (availableCents < amountCents) {
    return NextResponse.json(
      {
        error: "insufficient_funds",
        message: `Solde insuffisant (${(availableCents / 100).toFixed(2).replace(".", ",")} € disponibles).`,
      },
      { status: 409 },
    );
  }

  const stripe = await getStripe();

  // Crée d'abord la row transaction "pending" pour pouvoir y rattacher
  // le transfer Stripe en metadata (et le retrouver depuis le webhook).
  const { data: txRow, error: txErr } = await admin
    .from("transactions")
    .insert({
      account_id: prospectId,
      account_kind: "prospect",
      type: "withdrawal",
      status: "pending",
      amount_cents: amountCents,
      description: `Retrait vers Stripe Connect ${prospect.stripe_connect_account_id}`,
    })
    .select("id")
    .single();
  if (txErr || !txRow) {
    console.error("[/api/prospect/payout/withdraw] insert tx failed:", txErr);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  try {
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: "eur",
      destination: prospect.stripe_connect_account_id,
      metadata: {
        clerkUserId: userId,
        prospectId,
        transactionId: txRow.id,
      },
    });
    void (async () => {
      const { recordEvent } = await import("@/lib/admin/events/record");
      await recordEvent({
        type: "transaction.withdrawal",
        prospectId,
        transactionId: txRow.id,
        payload: { amountCents },
      });
    })();
    return NextResponse.json({
      ok: true,
      transferId: transfer.id,
      transactionId: txRow.id,
    });
  } catch (err) {
    // Échec immédiat → annule la transaction pour ne pas bloquer le solde.
    console.error("[/api/prospect/payout/withdraw] transfer error:", err);
    await admin
      .from("transactions")
      .update({ status: "failed" })
      .eq("id", txRow.id);
    const message = err instanceof Error ? err.message : "transfer_failed";
    return NextResponse.json({ error: "transfer_failed", message }, { status: 500 });
  }
}
