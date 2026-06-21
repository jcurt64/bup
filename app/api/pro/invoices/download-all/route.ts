/**
 * GET /api/pro/invoices/download-all — télécharge TOUTES les factures du
 * pro connecté dans un seul PDF (une facture par page).
 *
 * Pendant « bulk » de /api/pro/invoices/:id/pdf : mêmes sources
 * (`transactions` filtrées sur account_kind='pro' AND account_id=proId,
 * + identité société de `pro_accounts`), même numérotation déterministe.
 * Réservé au pro propriétaire — aucune transaction d'un autre compte ne
 * peut être incluse (filtre account_id).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { buildInvoicesPdf, type InvoiceData, type ProBillingInfo } from "@/lib/invoices/pdf";

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

  const [{ data: txs, error: txErr }, { data: pro, error: proErr }] = await Promise.all([
    admin
      .from("transactions")
      .select("id, type, status, amount_cents, description, created_at")
      .eq("account_kind", "pro")
      .eq("account_id", proId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("pro_accounts")
      .select("raison_sociale, adresse, ville, code_postal, siren, secteur, forme_juridique, capital_social_cents, siret, rcs_ville, rm_number, numero_tva")
      .eq("id", proId)
      .single(),
  ]);

  if (txErr || proErr) {
    console.error("[/api/pro/invoices/download-all] read error", txErr ?? proErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const invoices: InvoiceData[] = (txs ?? []).map((tx) => ({
    number: invoiceNumber(tx.id, tx.created_at),
    date: tx.created_at,
    label: TYPE_LABELS[tx.type] ?? tx.type,
    description: tx.description ?? null,
    amountCents: Number(tx.amount_cents ?? 0),
    statusLabel: STATUS_LABELS[tx.status] ?? tx.status,
    type: tx.type,
  }));

  if (invoices.length === 0) {
    return NextResponse.json({ error: "no_invoices" }, { status: 404 });
  }

  const billing: ProBillingInfo = {
    raisonSociale: pro?.raison_sociale ?? "—",
    adresse: pro?.adresse ?? null,
    ville: pro?.ville ?? null,
    codePostal: pro?.code_postal ?? null,
    siren: pro?.siren ?? null,
    secteur: pro?.secteur ?? null,
    // Email tiré de Clerk (pas stocké en colonne sur pro_accounts).
    email,
    formeJuridique: pro?.forme_juridique ?? null,
    capitalSocialEur:
      pro?.capital_social_cents == null
        ? null
        : Number(pro.capital_social_cents) / 100,
    siret: pro?.siret ?? null,
    rcsVille: pro?.rcs_ville ?? null,
    rmNumber: pro?.rm_number ?? null,
    numeroTva: pro?.numero_tva ?? null,
  };

  const buf = await buildInvoicesPdf(invoices, billing);
  // Nom de fichier : BUUPP-factures-YYYY-MM-DD.pdf (date d'émission).
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="BUUPP-factures-${today}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
