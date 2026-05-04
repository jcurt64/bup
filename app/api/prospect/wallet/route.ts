/**
 * GET /api/prospect/wallet — agrégats du portefeuille du prospect connecté.
 *
 * Renvoie :
 *   - monthGains       : cumul des gains du mois courant (header dashboard).
 *   - lifetimeGains    : cumul total des gains depuis l'ouverture du compte
 *                        ("Cumulé depuis ouverture" dans l'onglet Portefeuille).
 *   - available        : solde immédiatement retirable
 *                        = lifetimeGains − retraits déjà exécutés.
 *   - relationsCount   : nombre total de mises en relation reçues depuis
 *                        la création du compte (toutes statuts confondus).
 *   - accountCreatedAt : prospects.created_at, sert à dater le cumul.
 *   - withdrawThresholdEur : seuil en-dessous duquel le retrait est bloqué
 *                            (5 €, contrainte produit).
 *
 * Définition d'une transaction "gain" :
 *   - account_kind = 'prospect' & account_id = prospect.id
 *   - type ∈ {'credit', 'referral_bonus'}
 *   - status = 'completed'
 *
 * Auth Clerk obligatoire. Lecture en service_role pour bypasser les RLS
 * sur `transactions` (la row prospect courante est filtrée explicitement).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const runtime = "nodejs";

const WITHDRAW_THRESHOLD_EUR = 5;

async function getProspectId(userId: string): Promise<string> {
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  return ensureProspect({
    clerkUserId: userId,
    email,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });
}

function startOfMonthIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();
}

const sumAmounts = (rows: { amount_cents: number | null }[] | null) =>
  (rows ?? []).reduce((acc, r) => acc + Number(r.amount_cents ?? 0), 0);

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const prospectId = await getProspectId(userId);
  const admin = createSupabaseAdminClient();

  const monthStart = startOfMonthIso();

  // Lectures parallèles : 4 requêtes ciblées, toutes indexées sur
  // (account_id, account_kind, status) ou (prospect_id) pour relations.
  const [gainsLifetime, gainsMonth, withdrawals, relations, prospectRow] =
    await Promise.all([
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
        .in("type", ["credit", "referral_bonus"])
        .eq("status", "completed")
        .gte("created_at", monthStart),
      admin
        .from("transactions")
        .select("amount_cents")
        .eq("account_kind", "prospect")
        .eq("account_id", prospectId)
        .eq("type", "withdrawal")
        .eq("status", "completed"),
      admin
        .from("relations")
        .select("id", { count: "exact", head: true })
        .eq("prospect_id", prospectId),
      admin
        .from("prospects")
        .select("created_at")
        .eq("id", prospectId)
        .single(),
    ]);

  const lifetimeCents = sumAmounts(gainsLifetime.data);
  const monthCents = sumAmounts(gainsMonth.data);
  const withdrawnCents = sumAmounts(withdrawals.data);
  const availableCents = Math.max(0, lifetimeCents - withdrawnCents);

  return NextResponse.json({
    monthStart,
    monthGainsCents: monthCents,
    monthGainsEur: Math.round(monthCents) / 100,
    lifetimeGainsCents: lifetimeCents,
    lifetimeGainsEur: Math.round(lifetimeCents) / 100,
    availableCents,
    availableEur: Math.round(availableCents) / 100,
    canWithdraw: availableCents >= WITHDRAW_THRESHOLD_EUR * 100,
    withdrawThresholdEur: WITHDRAW_THRESHOLD_EUR,
    relationsCount: relations.count ?? 0,
    accountCreatedAt: prospectRow.data?.created_at ?? null,
  });
}
