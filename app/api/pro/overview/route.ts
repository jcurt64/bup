/**
 * GET /api/pro/overview — KPI cards de la Vue d'ensemble pro.
 *  - contactsAccepted30d : count(relations status in (accepted, settled) AND decided_at >= 30d ago)
 *  - acceptanceRate      : wins / finals (toutes campagnes confondues)
 *  - avgCostCents        : moyenne des reward_cents sur relations gagnées 30d
 *  - lastAcceptances     : 4 dernières acceptations pour le tableau "Dernières acceptations"
 *  - tierBreakdown       : 5 paliers, count + somme reward
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("relations")
    .select(
      `id, status, reward_cents, decided_at,
       campaigns ( name, targeting ),
       prospects:prospect_id ( bupp_score,
         prospect_identity ( prenom, nom )
       )`,
    )
    .eq("pro_account_id", proId)
    .order("decided_at", { ascending: false });

  if (error) {
    console.error("[/api/pro/overview] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type Row = {
    id: string;
    status: string;
    reward_cents: number;
    decided_at: string | null;
    campaigns: { name: string; targeting: { requiredTiers?: number[] } | null } | null;
    prospects: {
      bupp_score: number;
      prospect_identity: { prenom: string | null; nom: string | null } | null;
    } | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const c = Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns;
    const id = Array.isArray(r.prospects) ? r.prospects[0] : r.prospects;
    const pi = id?.prospect_identity
      ? (Array.isArray(id.prospect_identity) ? id.prospect_identity[0] : id.prospect_identity)
      : null;
    const tiers = (c?.targeting?.requiredTiers ?? [1]) as number[];
    return {
      id: r.id,
      status: r.status,
      reward_cents: Number(r.reward_cents ?? 0),
      decided_at: r.decided_at,
      campaign: c?.name ?? "—",
      tier: Math.max(1, ...tiers.map((n) => Number(n) || 0)),
      score: id?.bupp_score ?? 0,
      name: `${pi?.prenom ?? ""} ${pi?.nom ?? ""}`.trim() || "Prospect anonyme",
    };
  });

  const isWin = (s: string) => s === "accepted" || s === "settled";
  const isFinal = (s: string) =>
    s === "accepted" || s === "settled" || s === "refused" || s === "expired";

  const wins30d = rows.filter(
    (r) => isWin(r.status) && r.decided_at && r.decided_at >= since,
  );
  const finals = rows.filter((r) => isFinal(r.status));
  const wins = rows.filter((r) => isWin(r.status));
  const acceptanceRate =
    finals.length === 0 ? 0 : Math.round((wins.length / finals.length) * 100);
  const avgCostCents =
    wins30d.length === 0
      ? 0
      : Math.round(
          wins30d.reduce((acc, r) => acc + r.reward_cents, 0) / wins30d.length,
        );

  const lastAcceptances = wins.slice(0, 4).map((r) => ({
    name: r.name, score: r.score, campaign: r.campaign, tier: r.tier,
    receivedAt: r.decided_at, costCents: r.reward_cents,
  }));

  const tierBreakdown = [1, 2, 3, 4, 5].map((tier) => {
    const ws = wins.filter((r) => r.tier === tier);
    return {
      tier,
      label: ["Identification","Localisation","Style de vie","Pro","Patrimoine"][tier - 1],
      contacts: ws.length,
      totalCents: ws.reduce((acc, r) => acc + r.reward_cents, 0),
    };
  });

  return NextResponse.json({
    contactsAccepted30d: wins30d.length,
    acceptanceRate,
    avgCostCents,
    lastAcceptances,
    tierBreakdown,
  });
}
