/**
 * Lit les KPIs de la vue d'ensemble via la RPC `admin_overview_kpis`.
 * Le revenu BUUPP est RÉEL : somme nette des écritures `buupp_commission`
 * côté pro sur la période (commissions d'acceptation 10 %/min. 0,30 €,
 * option Vitrine, prolongations), contre-passations de remboursement
 * incluses (écritures positives).
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/admin/periods";

export type OverviewKpis = {
  waitlist: number;
  prospects: number;
  pros: number;
  activeCampaigns: number;
  campaignsCreated: number;
  relationsSent: number;
  relationsAccepted: number;
  acceptanceRatePct: number;
  budgetCents: number;
  spentCents: number;
  creditedCents: number;
  topupCents: number;
  campaignChargeCents: number;
  estimatedRevenueCents: number;
};

export async function fetchOverviewKpis(range: DateRange): Promise<OverviewKpis> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_overview_kpis", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) {
    console.error("[admin/queries/overview] rpc failed", error);
    throw error;
  }
  const raw = (data as Record<string, number>) ?? {};

  const relationsSent = raw.relationsSent ?? 0;
  const relationsAccepted = raw.relationsAccepted ?? 0;
  const acceptanceRatePct =
    relationsSent === 0 ? 0 : Math.round((relationsAccepted / relationsSent) * 100);

  const estimatedRevenueCents = await sumBuuppRevenueCents(admin, range);

  return {
    waitlist: raw.waitlist ?? 0,
    prospects: raw.prospects ?? 0,
    pros: raw.pros ?? 0,
    activeCampaigns: raw.activeCampaigns ?? 0,
    campaignsCreated: raw.campaignsCreated ?? 0,
    relationsSent,
    relationsAccepted,
    acceptanceRatePct,
    budgetCents: raw.budgetCents ?? 0,
    spentCents: raw.spentCents ?? 0,
    creditedCents: raw.creditedCents ?? 0,
    topupCents: raw.topupCents ?? 0,
    campaignChargeCents: raw.campaignChargeCents ?? 0,
    estimatedRevenueCents,
  };
}

const PAGE = 1000;

/** Revenu BUUPP net (centimes, positif) sur la période. */
async function sumBuuppRevenueCents(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  range: DateRange,
): Promise<number> {
  let total = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("transactions")
      .select("amount_cents")
      .eq("account_kind", "pro")
      .eq("type", "buupp_commission")
      .eq("status", "completed")
      .gte("created_at", range.start.toISOString())
      .lt("created_at", range.end.toISOString())
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[admin/queries/overview] revenue read failed", error);
      return 0;
    }
    const rows = (data ?? []) as Array<{ amount_cents: number | null }>;
    for (const r of rows) total += -Number(r.amount_cents ?? 0);
    if (rows.length < PAGE) break;
  }
  return Math.max(0, total);
}

// Cache process-local 30 s par fenêtre temporelle. Évite de spammer la
// RPC sur des rafraîchissements rapprochés (overview est appelée à
// chaque navigation côté admin). Une instance par worker → suffisant
// en V1 ; à remplacer par Redis/Upstash si on déploie à plusieurs.
const cache = new Map<string, { at: number; data: OverviewKpis }>();
const TTL_MS = 30_000;

export async function fetchOverviewKpisCached(range: DateRange): Promise<OverviewKpis> {
  const key = `${range.start.toISOString()}|${range.end.toISOString()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = await fetchOverviewKpis(range);
  cache.set(key, { at: Date.now(), data });
  return data;
}
