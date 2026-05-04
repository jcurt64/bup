/**
 * GET /api/pro/wallet — solde et compteurs du portefeuille pro.
 *
 * Retourne le `wallet_balance_cents` du compte pro courant (créé à la
 * volée si absent via `ensureProAccount`) ainsi que les valeurs en euros
 * et BUUPP coins prêtes à afficher. Source de vérité : la colonne
 * `pro_accounts.wallet_balance_cents`, mise à jour par le webhook
 * Stripe `checkout.session.completed` à chaque recharge réussie.
 *
 * Réponse :
 *   { walletBalanceCents, walletBalanceEur, raisonSociale }
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

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
    .select("wallet_balance_cents, raison_sociale")
    .eq("id", proId)
    .single();

  const cents = Number(pro?.wallet_balance_cents ?? 0);
  return NextResponse.json({
    walletBalanceCents: cents,
    walletBalanceEur: Math.round(cents) / 100,
    raisonSociale: pro?.raison_sociale ?? null,
  });
}
