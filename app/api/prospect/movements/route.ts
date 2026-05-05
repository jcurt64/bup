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

type CampaignsJoin = {
  status: string | null;
  brief: string | null;
  starts_at: string | null;
  ends_at: string | null;
  targeting: Record<string, unknown> | null;
} | null;
type ProJoin = {
  raison_sociale: string | null;
  secteur: string | null;
  ville: string | null;
} | null;
type RelationsJoin = {
  id: string;
  motif: string | null;
  reward_cents: number | string;
  status: string;
  sent_at: string;
  expires_at: string;
  decided_at: string | null;
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
  relation_id: string | null;
  relations: RelationsJoin;
};

function highestTier(targeting: Record<string, unknown> | null): number | null {
  const t = targeting?.requiredTiers;
  if (!Array.isArray(t) || t.length === 0) return null;
  const max = Math.max(...t.map((n) => Number(n) || 0));
  if (!Number.isFinite(max) || max < 1) return null;
  return Math.min(5, Math.max(1, max));
}

function relationTimerString(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expirée";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h} h ${String(m).padStart(2, "0")} min`;
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
      `id, type, status, amount_cents, description, created_at, relation_id,
       relations:relation_id (
         id, motif, reward_cents, status, sent_at, expires_at, decided_at,
         campaigns ( status, brief, starts_at, ends_at, targeting ),
         pro_accounts ( raison_sociale, secteur, ville )
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

  const allRows = (data ?? []) as unknown as TransactionRow[];
  const now = Date.now();

  // Déduplication par relation_id — un cycle accept → refuse → accept
  // empile plusieurs transactions prospect dans la base (escrow pending
  // créé à chaque accept, marqué canceled à chaque refuse). L'historique
  // utilisateur ne doit présenter qu'UNE ligne par relation, reflétant
  // l'état courant. La requête est déjà triée par created_at desc, donc
  // la première occurrence rencontrée est la plus récente — on garde
  // celle-là et on jette les versions plus anciennes.
  // Les transactions sans relation_id (retraits, parrainages sans
  // campagne, recharges…) sont conservées intégralement.
  const seenRelationIds = new Set<string>();
  const rows: TransactionRow[] = [];
  for (const r of allRows) {
    if (!r.relation_id) {
      rows.push(r);
      continue;
    }
    if (seenRelationIds.has(r.relation_id)) continue;
    seenRelationIds.add(r.relation_id);
    rows.push(r);
  }

  // Construit l'objet `relation` qui sera passé à RelationDetailModal côté
  // front — même forme que les entries de /api/prospect/relations#history,
  // pour que la modale puisse être réutilisée verbatim au clic sur la
  // ligne du tableau Portefeuille.
  function buildRelation(rel: NonNullable<RelationsJoin>) {
    const reward = Number(rel.reward_cents ?? 0) / 100;
    const proName = (rel.pro_accounts?.raison_sociale ?? "").trim() || "—";
    const sectorParts = [rel.pro_accounts?.secteur, rel.pro_accounts?.ville]
      .filter((s): s is string => !!s);
    const tier = highestTier(rel.campaigns?.targeting ?? null);
    const decisionLabel =
      rel.status === "accepted" || rel.status === "settled" ? "Acceptée"
      : rel.status === "refused" ? "Refusée"
      : rel.status === "expired" ? "Expirée"
      : "En attente";
    const statusDisplay =
      rel.status === "settled" ? "Crédité" :
      rel.status === "accepted" ? "En séquestre" :
      rel.status === "refused" ? "—" :
      rel.status === "expired" ? "—" : "—";
    const gain =
      rel.status === "accepted" || rel.status === "settled" ? reward : null;
    const campEndsMs = rel.campaigns?.ends_at
      ? new Date(rel.campaigns.ends_at).getTime()
      : null;
    const campaignActive =
      rel.campaigns?.status === "active" &&
      (campEndsMs == null || campEndsMs > now);
    const campaignOpen =
      campaignActive && rel.status !== "accepted" && rel.status !== "settled";
    return {
      id: rel.id,
      date: rel.decided_at ?? rel.sent_at,
      proName,
      pro: proName,
      sector: sectorParts.join(" · "),
      motif: rel.motif ?? "",
      brief: rel.campaigns?.brief ?? null,
      reward,
      tier: tier ?? 1,
      timer: relationTimerString(rel.expires_at),
      startDate: rel.campaigns?.starts_at ?? rel.sent_at,
      endDate: rel.campaigns?.ends_at ?? rel.expires_at,
      decision: decisionLabel,
      status: statusDisplay,
      relationStatus: rel.status,
      gain,
      campaignStatus: rel.campaigns?.status ?? null,
      campaignOpen,
      campaignActive,
    };
  }

  const movements = rows.map((r) => {
    const cents = Number(r.amount_cents ?? 0);
    const eur = cents / 100;
    const relation = r.relations && r.relation_id ? buildRelation(r.relations) : null;
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
      relation,
    };
  });

  return NextResponse.json({ movements });
}
