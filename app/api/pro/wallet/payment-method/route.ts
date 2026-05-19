/**
 * GET /api/pro/wallet/payment-method — carte bancaire enregistrée.
 *
 * Lit `pro_accounts.stripe_default_payment_method_id` puis récupère la
 * PaymentMethod côté Stripe pour exposer marque / 4 derniers /
 * expiration. Dégradé : toute erreur (pas de PM, Stripe KO) → { card:
 * null } (la page Facturation ne casse jamais). Jamais de 500.
 *
 * En mode TEST : renvoie la carte de test enregistrée. En LIVE : la
 * vraie carte, sans changement de code.
 *
 * Réponse : { card: { brand, last4, expMonth, expYear } | null }
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { getStripe } from "@/lib/stripe/server";

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

  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const { data: pro } = await admin
    .from("pro_accounts")
    .select("stripe_default_payment_method_id")
    .eq("id", proId)
    .single();

  const pmId = pro?.stripe_default_payment_method_id ?? null;
  if (!pmId) {
    return NextResponse.json({ card: null });
  }

  try {
    const stripe = await getStripe();
    const pm = await stripe.paymentMethods.retrieve(pmId);
    const card = pm.card
      ? {
          brand: pm.card.brand ?? null,
          last4: pm.card.last4 ?? null,
          expMonth: pm.card.exp_month ?? null,
          expYear: pm.card.exp_year ?? null,
        }
      : null;
    return NextResponse.json({ card });
  } catch (err) {
    console.error(
      "[/api/pro/wallet/payment-method] Stripe retrieve échoué :",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ card: null });
  }
}
