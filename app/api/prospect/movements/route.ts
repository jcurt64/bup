/**
 * GET /api/prospect/movements — historique des mouvements financiers du
 * prospect connecté, formaté pour la table "Historique des mouvements"
 * de l'onglet Portefeuille.
 *
 * Source : table `transactions` filtrée sur (account_kind='prospect',
 * account_id=prospectId), enrichie via relations → pro_accounts (raison
 * sociale = origine) et campaigns (targeting → palier).
 *
 * Mapping métier (frontend Prospect.jsx > Portefeuille) :
 *   - Date    : created_at formatée fr-FR
 *   - Origine : raison sociale du pro pour les escrow/credit liés à une
 *               relation, sinon description (parrainage, retrait, etc.)
 *   - Palier  : déduit de campaigns.targeting.requiredTiers (max), ou "—"
 *   - Statut  : libellé utilisateur dérivé du couple (type, status)
 *   - Montant : amount_cents/100, signé (entrée/sortie)
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import { settleRipeRelationsAndNotify } from "@/lib/settle/ripe";

export const runtime = "nodejs";

type CampaignsJoin = { targeting: Record<string, unknown> | null } | null;
type ProJoin = { raison_sociale: string | null } | null;
type RelationsJoin = {
  campaigns: CampaignsJoin;
  pro_accounts: ProJoin;
} | null;

type TransactionRow = {
  id: string;
  type: string;
  status: string;
  amount_cents: number | string;
  description: string;
  created_at: string;
  relations: RelationsJoin;
};

function highestTier(targeting: Record<string, unknown> | null): number | null {
  const t = targeting?.requiredTiers;
  if (!Array.isArray(t) || t.length === 0) return null;
  const max = Math.max(...t.map((n) => Number(n) || 0));
  if (!Number.isFinite(max) || max < 1) return null;
  return Math.min(5, Math.max(1, max));
}

function statusLabel(type: string, status: string): string {
  if (type === "withdrawal") return status === "completed" ? "Exécuté" : "En cours";
  if (type === "escrow")
    return status === "pending" ? "En séquestre"
      : status === "completed" ? "Crédité"
      : status === "canceled" ? "Annulé" : status;
  if (type === "credit") return status === "completed" ? "Crédité" : status;
  if (type === "referral_bonus") return status === "completed" ? "Crédité" : status;
  if (type === "refund") return "Remboursé";
  return status;
}

// `chip-good` (vert), `chip-warn` (orange), ou "" (neutre) — aligné avec les
// classes CSS utilisées par la table de l'onglet Portefeuille.
function statusChip(type: string, status: string): "good" | "warn" | "" {
  if (type === "escrow" && status === "pending") return "warn";
  if ((type === "credit" || type === "referral_bonus") && status === "completed") return "good";
  if (type === "escrow" && status === "completed") return "good";
  return "";
}

function originLabel(row: TransactionRow): string {
  const raison = (row.relations?.pro_accounts?.raison_sociale ?? "").trim();
  if (raison) return raison;
  if (row.description) return row.description;
  return "—";
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
  const prospectId = await ensureProspect({
    clerkUserId: userId,
    email,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });

  const admin = createSupabaseAdminClient();

  // Lazy settle : convertit les escrow pending en credit completed avant
  // de lire la table — sinon les mouvements affichent encore "En séquestre"
  // pour des relations qui devraient déjà être créditées.
  await settleRipeRelationsAndNotify(admin);

  const { data, error } = await admin
    .from("transactions")
    .select(
      `id, type, status, amount_cents, description, created_at,
       relations:relation_id (
         campaigns ( targeting ),
         pro_accounts ( raison_sociale )
       )`,
    )
    .eq("account_kind", "prospect")
    .eq("account_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[/api/prospect/movements] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as TransactionRow[];

  const movements = rows.map((r) => {
    const cents = Number(r.amount_cents ?? 0);
    const eur = cents / 100;
    return {
      id: r.id,
      date: r.created_at,
      origin: originLabel(r),
      tier: highestTier(r.relations?.campaigns?.targeting ?? null),
      statusLabel: statusLabel(r.type, r.status),
      statusChip: statusChip(r.type, r.status),
      amountCents: cents,
      amountEur: eur,
      sign: cents >= 0 ? "+" : "−",
    };
  });

  return NextResponse.json({ movements });
}
