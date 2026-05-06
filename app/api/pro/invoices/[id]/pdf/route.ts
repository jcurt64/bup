/**
 * GET /api/pro/invoices/:id/pdf — télécharge la facture en PDF.
 *
 * Sources :
 *   - `transactions`    → ligne facturable (recharges, charges,
 *                         refunds, bonus de parrainage…)
 *   - `pro_accounts`    → identité société du destinataire (Mes
 *                         informations).
 *
 * Auth : seul le pro propriétaire de la transaction peut générer la
 * facture (vérif par account_kind=pro AND account_id=proId). Toute
 * tentative cross-pro renvoie 404 (pas 403, pour ne rien révéler).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { buildInvoicePdf, type InvoiceData, type ProBillingInfo } from "@/lib/invoices/pdf";

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

function invoiceNumber(id: string, createdAt: string): string {
  const date = new Date(createdAt);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const suffix = id.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase();
  return `BUUPP-${year}-${month}-${suffix}`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();

  const [{ data: tx, error: txErr }, { data: pro, error: proErr }] = await Promise.all([
    admin
      .from("transactions")
      .select("id, type, status, amount_cents, description, created_at, account_kind, account_id")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("pro_accounts")
      .select("raison_sociale, adresse, ville, code_postal, siren, secteur")
      .eq("id", proId)
      .single(),
  ]);

  if (txErr || proErr) {
    console.error("[/api/pro/invoices/:id/pdf] read error", txErr ?? proErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!tx || tx.account_kind !== "pro" || tx.account_id !== proId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const invoice: InvoiceData = {
    number: invoiceNumber(tx.id, tx.created_at),
    date: tx.created_at,
    label: TYPE_LABELS[tx.type] ?? tx.type,
    description: tx.description ?? null,
    amountCents: Number(tx.amount_cents ?? 0),
    statusLabel: STATUS_LABELS[tx.status] ?? tx.status,
    type: tx.type,
  };

  const billing: ProBillingInfo = {
    raisonSociale: pro?.raison_sociale ?? "—",
    adresse: pro?.adresse ?? null,
    ville: pro?.ville ?? null,
    codePostal: pro?.code_postal ?? null,
    siren: pro?.siren ?? null,
    secteur: pro?.secteur ?? null,
    // Email tiré de Clerk (pas stocké en colonne sur pro_accounts).
    email,
  };

  const buf = await buildInvoicePdf(invoice, billing);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${invoice.number}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
