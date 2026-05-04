/**
 * POST /api/stripe/webhook
 *
 * Endpoint signé par Stripe — vérifie la signature, dispatche les
 * événements vers le bon handler métier qui met à jour Supabase.
 *
 *   checkout.session.completed → recharge pro : crédit du wallet +
 *                                transaction `topup` `completed`.
 *   account.updated            → maj de l'état d'onboarding Connect
 *                                (payouts_enabled / details_submitted).
 *   transfer.created           → retrait prospect : transaction
 *                                `withdrawal` `pending` → `completed`
 *                                (les fonds ont quitté la plateforme).
 *   transfer.reversed          → idem → `failed` (pour libérer le solde).
 *
 * À configurer dans le dashboard Stripe :
 *   Developers → Webhooks → Add endpoint → <APP_URL>/api/stripe/webhook
 *   Cocher les 4 events ci-dessus.
 *   Copier le Signing Secret → STRIPE_WEBHOOK_SECRET.
 */

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const payload = await request.text(); // raw body requis pour la vérification
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET manquant");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const stripe = await getStripe();
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    console.error("[stripe webhook] signature error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  try {
    switch (event.type) {
      // ─── Recharge pro ──────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const md = session.metadata ?? {};
        if (md.kind !== "topup") break; // ignore les Checkout d'autres usages

        const proAccountId = md.proAccountId;
        const amountCents = Number(md.amountCents ?? session.amount_total ?? 0);
        if (!proAccountId || !amountCents) {
          console.warn("[stripe webhook] topup metadata incomplet", md);
          break;
        }

        // Idempotence : un même Checkout ne crédite qu'une seule fois.
        // Stripe peut retentrer sur retry → on vérifie l'absence de tx
        // existante via le payment_intent_id.
        const piId = (session.payment_intent as string) ?? session.id;
        const { data: existing } = await admin
          .from("transactions")
          .select("id")
          .eq("stripe_payment_intent_id", piId)
          .maybeSingle();
        if (existing) break;

        // 1) Trace la transaction. Montant payé == montant crédité
        //    (plus de bonus appliqué).
        await admin.from("transactions").insert({
          account_id: proAccountId,
          account_kind: "pro",
          type: "topup",
          status: "completed",
          amount_cents: amountCents,
          stripe_payment_intent_id: piId,
          description: `Recharge BUUPP via Stripe (${(amountCents / 100).toFixed(2)} € crédités)`,
        });

        // 2) Crédite le wallet pro.
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
        break;
      }

      // ─── Onboarding Connect Express ───────────────────────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const { error } = await admin
          .from("prospects")
          .update({
            stripe_payouts_enabled: Boolean(account.payouts_enabled),
            stripe_details_submitted: Boolean(account.details_submitted),
          })
          .eq("stripe_connect_account_id", account.id);
        if (error) {
          console.warn("[stripe webhook] account.updated unmatched", account.id, error);
        }
        break;
      }

      // ─── Retrait prospect : transfer effectif ─────────────────────
      // Stripe émet `transfer.created` dès que les fonds quittent le
      // solde plateforme vers le compte Connect. Pour notre besoin, c'est
      // le moment où on peut considérer la transaction comme acquise
      // (la suite — payout vers IBAN — est gérée par Stripe).
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        const txId = transfer.metadata?.transactionId;
        if (!txId) break;
        await admin
          .from("transactions")
          .update({ status: "completed" })
          .eq("id", txId)
          .eq("status", "pending");
        break;
      }
      case "transfer.reversed": {
        const transfer = event.data.object as Stripe.Transfer;
        const txId = transfer.metadata?.transactionId;
        if (!txId) break;
        await admin
          .from("transactions")
          .update({ status: "failed" })
          .eq("id", txId);
        break;
      }

      case "payment_intent.payment_failed":
        // Échec carte côté Checkout → Stripe redirige déjà l'utilisateur
        // vers cancel_url ; on logge pour observabilité, sans action DB.
        console.warn("[stripe webhook] payment_intent.payment_failed", event.id);
        break;

      default:
        // Événement non géré — on ACK pour éviter les retries Stripe.
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler crash:", err);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
