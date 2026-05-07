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
    .select("wallet_balance_cents, wallet_reserved_cents, raison_sociale")
    .eq("id", proId)
    .single();

  // Solde réel (`walletBalanceCents`) — n'inclut PAS encore les débits
  // des campagnes en cours (le pro les voit déjà mais le wallet n'a
  // pas encore été ponctionné).
  // Réservé (`walletReservedCents`) — somme des (budget + commission max)
  // des campagnes actives non encore clôturées. Croisée à la création,
  // libérée à la clôture (close_campaign_settle).
  // Disponible (`walletAvailableCents`) = solde - réservé. C'est la
  // valeur à utiliser pour gating des nouvelles campagnes.
  const balance = Number(pro?.wallet_balance_cents ?? 0);
  const reserved = Number(pro?.wallet_reserved_cents ?? 0);
  const available = Math.max(0, balance - reserved);
  return NextResponse.json({
    walletBalanceCents: balance,
    walletBalanceEur: Math.round(balance) / 100,
    walletReservedCents: reserved,
    walletReservedEur: Math.round(reserved) / 100,
    walletAvailableCents: available,
    walletAvailableEur: Math.round(available) / 100,
    raisonSociale: pro?.raison_sociale ?? null,
  });
}
