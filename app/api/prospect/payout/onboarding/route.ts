/**
 * POST /api/prospect/payout/onboarding
 *
 * Crée (ou récupère) un compte Stripe Connect Express pour le prospect
 * connecté, puis génère un Account Link à usage unique pour
 * l'onboarding KYC. Le client redirige vers `link.url` ; au retour
 * (ou refresh expiré), Stripe ramène l'utilisateur vers `return_url`.
 *
 * Le webhook `account.updated` mettra à jour `prospects.stripe_payouts_enabled`
 * et `prospects.stripe_details_submitted` au fil de la complétion.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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
    .select("stripe_connect_account_id")
    .eq("id", prospectId)
    .single();

  const stripe = await getStripe();

  // 1) Crée le compte Connect Express si pas encore fait. Type "express"
  //    = onboarding hébergé par Stripe → KYC + IBAN sortant gérés en
  //    dehors de notre app (réduit la surface compliance pour BUUPP).
  let accountId = prospect?.stripe_connect_account_id ?? null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "FR",
      email: email ?? undefined,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: { clerkUserId: userId, prospectId },
    });
    accountId = account.id;
    await admin
      .from("prospects")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", prospectId);
  }

  // 2) Account Link (one-shot, expire en ~5 min). À régénérer à chaque
  //    fois que l'utilisateur revient sur la page.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/prospect?onboarding=refresh`,
    return_url: `${appUrl}/prospect?onboarding=done`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url, accountId });
}
