/**
 * GET /api/prospect/relations — sollicitations reçues par le prospect connecté.
 *
 * Découpage côté serveur en deux listes :
 *   - pending  : status='pending' AND expires_at > now() — affichées en cards.
 *   - history  : tout le reste, triées par sent_at desc (ordre Postgres).
 *
 * Champs renvoyés taillés pour le composant `Relations` de Prospect.jsx.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import { settleRipeRelationsAndNotify } from "@/lib/settle/ripe";
import { reportedRelationIds } from "@/lib/prospect/reports";

export const runtime = "nodejs";

type RelationRow = {
  id: string;
  campaign_id: string;
  motif: string;
  // bigint en DB → renvoyé comme number par PostgREST tant qu'on reste sous 2^53.
  // On garde `number | string` par sécurité (le `Number()` côté handler couvre les deux).
  reward_cents: number | string;
  status: string;
  sent_at: string;
  expires_at: string;
  decided_at: string | null;
  campaigns: {
    name: string;
    status: string;
    brief: string | null;
    starts_at: string;
    ends_at: string | null;
    targeting: Record<string, unknown> | null;
  } | null;
  pro_accounts: {
    raison_sociale: string;
    secteur: string | null;
    ville: string | null;
  } | null;
};

// Affiche la raison sociale telle qu'elle est saisie dans `pro_accounts`.
// Si la valeur est null/vide on retombe sur un tiret pour ne pas afficher
// "undefined" côté UI — la complétion des infos société reste à la charge du pro.
function displayProName(raison: string | null | undefined): string {
  const v = (raison ?? "").trim();
  return v || "—";
}

function timerString(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expirée";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

function highestTier(targeting: Record<string, unknown> | null): number {
  const t = targeting?.requiredTiers;
  if (!Array.isArray(t)) return 1;
  const max = Math.max(...t.map((n) => Number(n) || 0), 1);
  return Math.min(5, Math.max(1, max));
}

function isFlashDealTargeting(targeting: Record<string, unknown> | null): boolean {
  return targeting?.durationKey === "1h";
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

  // Lazy settle : matérialise les passages accepted → settled avant de
  // lire la table, pour que l'historique reflète immédiatement le statut
  // "Crédité" des relations dont la campagne a été lancée il y a > 3 min.
  await settleRipeRelationsAndNotify(admin);

  const { data, error } = await admin
    .from("relations")
    .select(
      `id, campaign_id, motif, reward_cents, status, sent_at, expires_at, decided_at,
       campaigns ( name, status, brief, starts_at, ends_at, targeting ),
       pro_accounts ( raison_sociale, secteur, ville )`,
    )
    .eq("prospect_id", prospectId)
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("[/api/prospect/relations] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as RelationRow[];
  const allRelationIds = rows.map((r) => r.id);
  const reportedSet = await reportedRelationIds(admin, prospectId, allRelationIds);
  const now = Date.now();

  const pending = rows
    .filter((r) => r.status === "pending" && new Date(r.expires_at).getTime() > now)
    .map((r) => {
      const reward = Number(r.reward_cents) / 100;
      const proName = displayProName(r.pro_accounts?.raison_sociale);
      const sectorParts = [r.pro_accounts?.secteur, r.pro_accounts?.ville].filter(
        Boolean,
      ) as string[];
      return {
        id: r.id,
        campaignId: r.campaign_id,
        pro: proName,
        sector: sectorParts.join(" · "),
        motif: r.motif,
        brief: r.campaigns?.brief ?? null,
        reward,
        tier: highestTier(r.campaigns?.targeting ?? null),
        timer: timerString(r.expires_at),
        startDate: r.campaigns?.starts_at ?? r.sent_at,
        endDate: r.campaigns?.ends_at ?? r.expires_at,
        isFlashDeal: isFlashDealTargeting(r.campaigns?.targeting ?? null),
        reported: reportedSet.has(r.id),
      };
    });

  const history = rows
    .filter(
      (r) => !(r.status === "pending" && new Date(r.expires_at).getTime() > now),
    )
    .map((r) => {
      const reward = Number(r.reward_cents) / 100;
      const decisionLabel =
        r.status === "accepted" || r.status === "settled"
          ? "Acceptée"
          : r.status === "refused"
            ? "Refusée"
            : "Expirée";
      const statusLabel =
        r.status === "settled" ? "Crédité" :
        r.status === "accepted" ? "En séquestre" : "—";
      const gain = r.status === "accepted" || r.status === "settled" ? reward : null;
      const date = r.decided_at ?? r.sent_at;
      const proName = displayProName(r.pro_accounts?.raison_sociale);
      const sectorParts = [r.pro_accounts?.secteur, r.pro_accounts?.ville].filter(
        Boolean,
      ) as string[];
      const campEnds = r.campaigns?.ends_at
        ? new Date(r.campaigns.ends_at).getTime()
        : null;
      // `campaignActive` : la campagne tourne toujours (status='active' &&
      // ends_at > now). Sert au front à savoir si on peut encore proposer
      // au prospect de refuser une relation déjà acceptée/settled (refund
      // pro + cancel de la transaction prospect).
      const campaignActive =
        r.campaigns?.status === "active" &&
        (campEnds == null || campEnds > now);
      // `campaignOpen` : campagne active ET la relation n'est pas déjà
      // acceptée/settled — utilisé pour l'acceptation rétroactive depuis
      // l'historique. Une relation accepted/settled ne se "ré-accepte" pas.
      const campaignOpen =
        campaignActive &&
        r.status !== "accepted" &&
        r.status !== "settled";
      return {
        id: r.id,
        campaignId: r.campaign_id,
        date,
        proName,
        // Champs miroir de `pending` pour permettre la réutilisation de
        // RelationDetailModal côté front (clic sur ligne d'historique).
        pro: proName,
        sector: sectorParts.join(" · "),
        motif: r.motif,
        brief: r.campaigns?.brief ?? null,
        reward,
        tier: highestTier(r.campaigns?.targeting ?? null),
        timer: timerString(r.expires_at),
        startDate: r.campaigns?.starts_at ?? r.sent_at,
        endDate: r.campaigns?.ends_at ?? r.expires_at,
        // Métadonnées historique
        decision: decisionLabel,
        status: statusLabel,
        relationStatus: r.status,
        gain,
        campaignStatus: r.campaigns?.status ?? null,
        campaignOpen,
        campaignActive,
        isFlashDeal: isFlashDealTargeting(r.campaigns?.targeting ?? null),
        reported: reportedSet.has(r.id),
      };
    });

  return NextResponse.json({ pending, history });
}
