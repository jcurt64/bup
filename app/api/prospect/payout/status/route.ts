/**
 * GET /api/prospect/payout/status
 *
 * Renvoie l'état d'onboarding Stripe Connect du prospect courant. Sert
 * à la modale "Retirer mes gains" pour décider d'afficher :
 *   - le CTA d'onboarding si pas encore commencé / non finalisé
 *   - le formulaire de retrait si payouts_enabled = true
 *
 * Source de vérité : `prospects.stripe_payouts_enabled` mis à jour par
 * le webhook `account.updated`. On rafraîchit en best-effort directement
 * depuis Stripe pour les cas où le webhook serait en retard.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    .select(
      "stripe_connect_account_id, stripe_payouts_enabled, stripe_details_submitted",
    )
    .eq("id", prospectId)
    .single();

  let payoutsEnabled = Boolean(prospect?.stripe_payouts_enabled);
  let detailsSubmitted = Boolean(prospect?.stripe_details_submitted);

  // Best-effort : si on a un account ID mais payouts pas encore activé en
  // base, on recharge Stripe (peut-être plus à jour que notre webhook).
  if (prospect?.stripe_connect_account_id && !payoutsEnabled) {
    try {
      const stripe = await getStripe();
      const account = await stripe.accounts.retrieve(
        prospect.stripe_connect_account_id,
      );
      payoutsEnabled = Boolean(account.payouts_enabled);
      detailsSubmitted = Boolean(account.details_submitted);
      if (
        payoutsEnabled !== prospect.stripe_payouts_enabled ||
        detailsSubmitted !== prospect.stripe_details_submitted
      ) {
        await admin
          .from("prospects")
          .update({
            stripe_payouts_enabled: payoutsEnabled,
            stripe_details_submitted: detailsSubmitted,
          })
          .eq("id", prospectId);
      }
    } catch (err) {
      console.warn("[/api/prospect/payout/status] Stripe refresh failed:", err);
    }
  }

  return NextResponse.json({
    hasAccount: Boolean(prospect?.stripe_connect_account_id),
    payoutsEnabled,
    detailsSubmitted,
  });
}
