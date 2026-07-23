/**
 * GET /api/prospect/wallet — agrégats du portefeuille du prospect connecté.
 *
 * Renvoie :
 *   - monthGains       : cumul des gains du mois courant (header dashboard).
 *   - lifetimeGains    : cumul total des gains depuis l'ouverture du compte
 *                        ("Cumulé depuis ouverture" dans l'onglet Portefeuille).
 *   - available        : solde affiché = lifetimeGains − retraits exécutés
 *                        + bonus fondateur encore verrouillé. Ce dernier est
 *                        montré car la somme appartient déjà au prospect,
 *                        mais il n'est PAS retirable.
 *   - withdrawable     : part réellement retirable = `available` moins le
 *                        bonus fondateur verrouillé. C'est elle qui est
 *                        comparée au seuil de 5 €.
 *   - escrow           : fonds en séquestre — somme des reward_cents des
 *                        relations status='accepted' (acceptées mais pas
 *                        encore settled au-delà de 72 h).
 *   - signupBonusCents        : bonus fondateur DÉBLOQUÉ (compté dans
 *                               `available`).
 *   - signupBonusPendingCents : bonus fondateur provisionné mais encore
 *                               verrouillé — exclu de tous les agrégats.
 *   - signupBonusUnlockAt     : date de déblocage = max(création du compte
 *                               + 3 mois, launch_at).
 *   - signupBonusHasAcceptance: true si ≥ 1 sollicitation acceptée.
 *   - signupBonusLocked       : true s'il reste un bonus verrouillé.
 *   - signupBonusClaimable    : true si les deux conditions sont réunies —
 *                               le prospect peut alors le débloquer
 *                               lui-même, le déblocage n'étant pas
 *                               automatique.
 *   - relationsCount   : nombre total de mises en relation reçues depuis
 *                        la création du compte (toutes statuts confondus).
 *   - accountCreatedAt : prospects.created_at, sert à dater le cumul.
 *   - withdrawThresholdEur : seuil en-dessous duquel le retrait est bloqué
 *                            (5 €, contrainte produit).
 *
 * Définition d'une transaction "gain" :
 *   - account_kind = 'prospect' & account_id = prospect.id
 *   - type ∈ {'credit', 'referral_bonus', 'signup_bonus'}
 *   - status = 'completed'
 *
 * Auth Clerk obligatoire. Lecture en service_role pour bypasser les RLS
 * sur `transactions` (la row prospect courante est filtrée explicitement).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import { settleRipeRelationsAndNotify } from "@/lib/settle/ripe";
import { syncFounderBonusesAndNotify } from "@/lib/founder-bonus/sync";
import { GAIN_TRANSACTION_TYPES } from "@/lib/prospect/transactions";

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

  // Lazy settle : matérialise les passages séquestre → disponible avant de
  // calculer les agrégats. Évite que la carte "Disponible" soit en retard
  // sur la réalité tant qu'aucune autre route n'a déclenché le settle.
  await settleRipeRelationsAndNotify(admin);

  // Idem pour le bonus fondateur : provisionne la ligne `pending` d'un
  // nouveau fondateur et débloque celle dont les conditions viennent
  // d'être réunies, avant de calculer les agrégats.
  await syncFounderBonusesAndNotify(admin);

  const monthStart = startOfMonthIso();

  // Lectures parallèles : 7 requêtes ciblées, toutes indexées sur
  // (account_id, account_kind, status) ou (prospect_id) pour relations.
  const [gainsLifetime, gainsMonth, withdrawals, escrowRelations, relations, prospectRow, signupBonus, signupBonusPending, unlockState] =
    await Promise.all([
      admin
        .from("transactions")
        .select("amount_cents")
        .eq("account_kind", "prospect")
        .eq("account_id", prospectId)
        .in("type", [...GAIN_TRANSACTION_TYPES])
        .eq("status", "completed"),
      admin
        .from("transactions")
        .select("amount_cents")
        .eq("account_kind", "prospect")
        .eq("account_id", prospectId)
        .in("type", [...GAIN_TRANSACTION_TYPES])
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
        .select("reward_cents")
        .eq("prospect_id", prospectId)
        .eq("status", "accepted"),
      admin
        .from("relations")
        .select("id", { count: "exact", head: true })
        .eq("prospect_id", prospectId),
      admin
        .from("prospects")
        .select("created_at")
        .eq("id", prospectId)
        .single(),
      admin
        .from("transactions")
        .select("amount_cents")
        .eq("account_kind", "prospect")
        .eq("account_id", prospectId)
        .eq("type", "signup_bonus")
        .eq("status", "completed"),
      admin
        .from("transactions")
        .select("amount_cents, created_at")
        .eq("account_kind", "prospect")
        .eq("account_id", prospectId)
        .eq("type", "signup_bonus")
        .eq("status", "pending"),
      admin.rpc("founder_bonus_unlock_state", { p_prospect_id: prospectId }),
    ]);

  const settledGainsCents = sumAmounts(gainsLifetime.data);
  const settledMonthCents = sumAmounts(gainsMonth.data);
  const withdrawnCents = sumAmounts(withdrawals.data);
  // Solde acquis : gains crédités moins les retraits. Le bonus fondateur
  // encore verrouillé s'y ajoute à l'affichage (cf. `availableCents`), mais
  // reste exclu de ce qui est réellement retirable.
  const settledCents = Math.max(0, settledGainsCents - withdrawnCents);
  const escrowCents = (escrowRelations.data ?? []).reduce(
    (acc, r) => acc + Number(r.reward_cents ?? 0),
    0,
  );
  const signupBonusCents = sumAmounts(signupBonus.data);
  const signupBonusPendingCents = sumAmounts(signupBonusPending.data);
  // La RPC renvoie une ligne (aucune si le prospect n'existe pas).
  const unlock = unlockState.data?.[0] ?? null;

  // Le bonus fondateur verrouillé est MONTRÉ dans le solde disponible — le
  // prospect doit voir que la somme lui appartient — mais il n'est pas
  // retirable et ne permet pas d'atteindre le minimum de retrait. D'où deux
  // notions distinctes : `availableCents` (affiché) et `withdrawableCents`
  // (ce que le retrait autorise réellement).
  const availableCents = settledCents + signupBonusPendingCents;
  const withdrawableCents = settledCents;

  // Le bonus verrouillé compte aussi dans les cumuls, sans quoi « Disponible »
  // dépasserait « Cumulé depuis ouverture » — un solde supérieur au total
  // jamais gagné. Pour les gains du MOIS, il n'est compté que s'il a été
  // provisionné ce mois-ci.
  const pendingBonusRows = (signupBonusPending.data ?? []) as {
    amount_cents: number | null;
    created_at: string | null;
  }[];
  const pendingBonusThisMonthCents = pendingBonusRows.reduce(
    (acc, r) =>
      acc + (r.created_at && r.created_at >= monthStart ? Number(r.amount_cents ?? 0) : 0),
    0,
  );
  const lifetimeCents = settledGainsCents + signupBonusPendingCents;
  const monthCents = settledMonthCents + pendingBonusThisMonthCents;

  return NextResponse.json({
    monthStart,
    monthGainsCents: monthCents,
    monthGainsEur: Math.round(monthCents) / 100,
    lifetimeGainsCents: lifetimeCents,
    lifetimeGainsEur: Math.round(lifetimeCents) / 100,
    availableCents,
    availableEur: Math.round(availableCents) / 100,
    signupBonusCents,
    signupBonusEur: Math.round(signupBonusCents) / 100,
    signupBonusPendingCents,
    signupBonusPendingEur: Math.round(signupBonusPendingCents) / 100,
    signupBonusLocked: signupBonusPendingCents > 0,
    signupBonusUnlockAt: unlock?.unlock_at ?? null,
    signupBonusHasAcceptance: unlock?.has_acceptance ?? false,
    // Conditions réunies : le prospect peut le récupérer lui-même
    // (POST /api/prospect/founder-bonus/claim). Rien ne se débloque seul.
    signupBonusClaimable: signupBonusPendingCents > 0 && unlock?.met === true,
    escrowCents,
    escrowEur: Math.round(escrowCents) / 100,
    withdrawableCents,
    withdrawableEur: Math.round(withdrawableCents) / 100,
    // Le bonus fondateur verrouillé ne compte pas pour atteindre le seuil.
    canWithdraw: withdrawableCents >= WITHDRAW_THRESHOLD_EUR * 100,
    withdrawThresholdEur: WITHDRAW_THRESHOLD_EUR,
    relationsCount: relations.count ?? 0,
    accountCreatedAt: prospectRow.data?.created_at ?? null,
  });
}
