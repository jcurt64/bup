/**
 * GET /api/pro/invoices — historique des factures du pro connecté.
 *
 * Source de vérité : la table `transactions`. On expose toutes les
 * transactions du compte pro courant (recharges, abonnements, refunds,
 * dépenses de campagnes…) avec un numéro de facture déterministe
 * dérivé de l'ID + date pour rester stable d'un fetch à l'autre.
 *
 * Format réponse :
 *   {
 *     invoices: [
 *       {
 *         number: "BUUPP-2026-04-1234",
 *         date: "2026-04-14",
 *         label: "Recharge crédit",
 *         amountEur: 515,
 *         status: "completed",
 *         transactionId: "uuid"
 *       },
 *       …
 *     ]
 *   }
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

const TYPE_LABELS: Record<string, string> = {
  topup: "Recharge crédit",
  campaign_charge: "Dépense campagne",
  refund: "Remboursement",
  withdrawal: "Retrait",
  credit: "Crédit",
  escrow: "Séquestre",
  referral_bonus: "Bonus parrainage",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Payée",
  pending: "En attente",
  failed: "Échec",
  canceled: "Annulée",
};

/**
 * Numéro de facture humanisé, stable et lisible :
 *   BUUPP-YYYY-MM-XXXX où XXXX = 4 derniers caractères de l'UUID
 * → unique en pratique sur la fenêtre d'un mois pour un même pro.
 */
function invoiceNumber(id: string, createdAt: string): string {
  const date = new Date(createdAt);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const suffix = id.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase();
  return `BUUPP-${year}-${month}-${suffix}`;
}

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

  const { data, error } = await admin
    .from("transactions")
    .select("id, type, status, amount_cents, description, created_at")
    .eq("account_kind", "pro")
    .eq("account_id", proId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[/api/pro/invoices] read error:", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const invoices = (data ?? []).map((row) => {
    const cents = Number(row.amount_cents ?? 0);
    return {
      number: invoiceNumber(row.id, row.created_at),
      date: row.created_at,
      label: TYPE_LABELS[row.type] ?? row.type,
      description: row.description,
      amountEur: Math.round(cents) / 100,
      amountCents: cents,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status] ?? row.status,
      transactionId: row.id,
      type: row.type,
    };
  });

  return NextResponse.json({ invoices });
}
