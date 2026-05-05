/**
 * GET /api/prospect/fiscal — récapitulatif fiscal annuel du prospect connecté.
 *
 * Alimente l'onglet "Informations fiscales" / section "Récapitulatif annuel"
 * de Prospect.jsx :
 *   - currentYear  : exercice en cours (cumul gagné, nombre de transactions)
 *   - previousYear : exercice clos N-1 (cumul gagné, transmis à la DGFiP)
 *
 * Définition d'un "gain" — alignée sur /api/prospect/wallet :
 *   - account_kind = 'prospect' & account_id = prospectId
 *   - type ∈ {'credit', 'referral_bonus'}
 *   - status = 'completed'
 *
 * Seuils fiscaux (constantes produit) :
 *   - thresholdEur          : 3 000 € — déclaration DGFiP des plateformes
 *   - thresholdTransactions : 20      — seuil de cumul transactionnel DGFiP
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const runtime = "nodejs";

const DGFIP_THRESHOLD_EUR = 3000;
const DGFIP_THRESHOLD_TRANSACTIONS = 20;

function yearBoundsIso(year: number): { startIso: string; endIso: string } {
  const startIso = new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString();
  const endIso = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)).toISOString();
  return { startIso, endIso };
}

const sumAmounts = (rows: { amount_cents: number | null }[] | null) =>
  (rows ?? []).reduce((acc, r) => acc + Number(r.amount_cents ?? 0), 0);

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

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const previousYear = currentYear - 1;
  const cur = yearBoundsIso(currentYear);
  const prev = yearBoundsIso(previousYear);

  // Lectures parallèles : amounts pour somme, count pour nombre de transactions.
  // Utilise l'index transactions_account_idx (account_id, account_kind, created_at).
  const [
    curAmounts,
    curCount,
    prevAmounts,
    prevCount,
  ] = await Promise.all([
    admin
      .from("transactions")
      .select("amount_cents")
      .eq("account_kind", "prospect")
      .eq("account_id", prospectId)
      .in("type", ["credit", "referral_bonus"])
      .eq("status", "completed")
      .gte("created_at", cur.startIso)
      .lt("created_at", cur.endIso),
    admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("account_kind", "prospect")
      .eq("account_id", prospectId)
      .in("type", ["credit", "referral_bonus"])
      .eq("status", "completed")
      .gte("created_at", cur.startIso)
      .lt("created_at", cur.endIso),
    admin
      .from("transactions")
      .select("amount_cents")
      .eq("account_kind", "prospect")
      .eq("account_id", prospectId)
      .in("type", ["credit", "referral_bonus"])
      .eq("status", "completed")
      .gte("created_at", prev.startIso)
      .lt("created_at", prev.endIso),
    admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("account_kind", "prospect")
      .eq("account_id", prospectId)
      .in("type", ["credit", "referral_bonus"])
      .eq("status", "completed")
      .gte("created_at", prev.startIso)
      .lt("created_at", prev.endIso),
  ]);

  const curCents = sumAmounts(curAmounts.data);
  const prevCents = sumAmounts(prevAmounts.data);

  const currentEur = Math.round(curCents) / 100;
  const previousEur = Math.round(prevCents) / 100;

  // La transmission à la DGFiP n'a lieu que si le prospect a dépassé l'un
  // des deux seuils (montant OU nombre de transactions). Sinon on n'a rien
  // transmis et on l'affiche côté UI.
  const previousReported =
    previousEur >= DGFIP_THRESHOLD_EUR ||
    (prevCount.count ?? 0) >= DGFIP_THRESHOLD_TRANSACTIONS;

  return NextResponse.json({
    thresholdEur: DGFIP_THRESHOLD_EUR,
    thresholdTransactions: DGFIP_THRESHOLD_TRANSACTIONS,
    currentYear: {
      year: currentYear,
      totalCents: curCents,
      totalEur: currentEur,
      transactionCount: curCount.count ?? 0,
      thresholdReached:
        currentEur >= DGFIP_THRESHOLD_EUR ||
        (curCount.count ?? 0) >= DGFIP_THRESHOLD_TRANSACTIONS,
    },
    previousYear: {
      year: previousYear,
      totalCents: prevCents,
      totalEur: previousEur,
      transactionCount: prevCount.count ?? 0,
      reportedToDgfip: previousReported,
    },
  });
}
