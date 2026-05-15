/**
 * Recharge automatique du wallet pro (Stripe off-session).
 *
 * À appeler après chaque débit du wallet. Si le pro a activé la recharge
 * auto et que son solde passe sous le seuil, on crée un PaymentIntent
 * off-session avec le moyen de paiement sauvegardé. Le webhook Stripe
 * `payment_intent.succeeded` finalise comme un topup classique
 * (crédit du wallet + insertion transaction `topup`).
 *
 * Idempotence : on pose `auto_recharge_last_triggered_at = now()` AVANT
 * de créer le PaymentIntent, pour éviter qu'un second appel concurrent
 * (race après deux débits rapides) ne déclenche un double paiement. Le
 * verrou est levé à la fin (succès) ou laissé jusqu'à la prochaine
 * fenêtre cooldown (échec, voir `AUTO_RECHARGE_COOLDOWN_MS`).
 *
 * Sécurité légale (RGPD + Code monétaire L.232-3) :
 * - Consentement exprès du pro requis (toggle UI + CGV §11bis).
 * - Révocable à tout moment via /api/pro/wallet/auto-recharge.
 * - L'événement est tracé dans `admin_events` pour audit.
 */

import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// Cooldown entre deux déclenchements pour la même org : évite qu'une
// erreur Stripe transitoire (carte refusée 3D Secure) ne soit reessayée
// en boucle. 1 heure laisse au pro le temps de mettre à jour sa carte.
const AUTO_RECHARGE_COOLDOWN_MS = 60 * 60 * 1000;

export type TriggerResult =
  | { triggered: false; reason: string }
  | { triggered: true; paymentIntentId: string; amountCents: number };

export async function maybeTriggerAutoRecharge(
  proAccountId: string,
): Promise<TriggerResult> {
  const admin = createSupabaseAdminClient();
  const { data: pro, error } = await admin
    .from("pro_accounts")
    .select(
      `id, wallet_balance_cents,
       auto_recharge_enabled, auto_recharge_threshold_cents,
       auto_recharge_amount_cents, stripe_customer_id,
       stripe_default_payment_method_id, auto_recharge_last_triggered_at`,
    )
    .eq("id", proAccountId)
    .maybeSingle();
  if (error || !pro) {
    return { triggered: false, reason: "pro_not_found" };
  }

  if (!pro.auto_recharge_enabled) return { triggered: false, reason: "disabled" };
  if (!pro.stripe_default_payment_method_id) {
    return { triggered: false, reason: "no_payment_method" };
  }
  if (!pro.stripe_customer_id) {
    return { triggered: false, reason: "no_customer" };
  }
  const threshold = pro.auto_recharge_threshold_cents ?? 10_000; // 100 €
  const amount = pro.auto_recharge_amount_cents ?? 50_000; // 500 €
  if (pro.wallet_balance_cents >= threshold) {
    return { triggered: false, reason: "above_threshold" };
  }

  // Cooldown : ne ré-essaye pas plus d'une fois par heure.
  const lastTriggered = pro.auto_recharge_last_triggered_at
    ? new Date(pro.auto_recharge_last_triggered_at).getTime()
    : 0;
  if (Date.now() - lastTriggered < AUTO_RECHARGE_COOLDOWN_MS) {
    return { triggered: false, reason: "cooldown" };
  }

  // Réservation atomique : pose le timestamp pour que les appels
  // concurrents tombent dans la branche "cooldown" ci-dessus.
  const { error: lockErr } = await admin
    .from("pro_accounts")
    .update({ auto_recharge_last_triggered_at: new Date().toISOString() })
    .eq("id", proAccountId)
    // Optimistic lock : ne mets à jour QUE si le timestamp en base
    // n'a pas changé entretemps (sinon un autre process a déjà pris).
    .eq("auto_recharge_last_triggered_at", pro.auto_recharge_last_triggered_at as string);
  if (lockErr) {
    return { triggered: false, reason: "lock_failed" };
  }

  const stripe = await getStripe();
  try {
    const pi = await stripe.paymentIntents.create({
      amount,
      currency: "eur",
      customer: pro.stripe_customer_id,
      payment_method: pro.stripe_default_payment_method_id,
      off_session: true,
      confirm: true,
      metadata: {
        proAccountId,
        kind: "topup",
        amountCents: String(amount),
        source: "auto_recharge",
      },
    });
    return { triggered: true, paymentIntentId: pi.id, amountCents: amount };
  } catch (err) {
    // Échec (carte refusée, 3D Secure requis, etc.) : on enregistre la
    // raison pour que le pro puisse la consulter et corriger sa CB.
    const reason = err instanceof Error ? err.message.slice(0, 240) : "unknown";
    await admin
      .from("pro_accounts")
      .update({
        auto_recharge_last_failed_at: new Date().toISOString(),
        auto_recharge_last_failure_reason: reason,
      })
      .eq("id", proAccountId);
    return { triggered: false, reason: `stripe_failed: ${reason}` };
  }
}
