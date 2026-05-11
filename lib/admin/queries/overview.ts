/**
 * Lit les KPIs de la vue d'ensemble via la RPC `admin_overview_kpis`.
 * Le revenu BUUPP est dérivé en TS à partir d'une env (take-rate
 * configurable sans toucher à la DB).
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
  // La RPC `admin_overview_kpis` borne waitlist/prospects/pros à
  // [p_start, p_end[ — pratique pour des flux périodiques, mais ça
  // affiche « 0 » dès qu'un inscrit historique tombe hors fenêtre, ce
  // qui diverge des onglets dédiés (/waitlist, /prospects, /pros) qui
  // listent le total. On compte donc en parallèle, en cumulatif jusqu'à
  // `range.end`. Le delta `current - previous` continue de représenter
  // les nouveaux inscrits sur la période courante.
  const endIso = range.end.toISOString();
  const [rpcRes, waitlistRes, prospectsRes, prosRes] = await Promise.all([
    admin.rpc("admin_overview_kpis", {
      p_start: range.start.toISOString(),
      p_end: endIso,
    }),
    admin
      .from("waitlist")
      .select("*", { count: "exact", head: true })
      .lte("created_at", endIso),
    admin
      .from("prospects")
      .select("*", { count: "exact", head: true })
      .lte("created_at", endIso),
    admin
      .from("pro_accounts")
      .select("*", { count: "exact", head: true })
      .lte("created_at", endIso),
  ]);

  if (rpcRes.error) {
    console.error("[admin/queries/overview] rpc failed", rpcRes.error);
    throw rpcRes.error;
  }
  if (waitlistRes.error) {
    console.error("[admin/queries/overview] waitlist count failed", waitlistRes.error);
    throw waitlistRes.error;
  }
  if (prospectsRes.error) {
    console.error("[admin/queries/overview] prospects count failed", prospectsRes.error);
    throw prospectsRes.error;
  }
  if (prosRes.error) {
    console.error("[admin/queries/overview] pros count failed", prosRes.error);
    throw prosRes.error;
  }

  const raw = (rpcRes.data as Record<string, number>) ?? {};

  const relationsSent = raw.relationsSent ?? 0;
  const relationsAccepted = raw.relationsAccepted ?? 0;
  const acceptanceRatePct =
    relationsSent === 0 ? 0 : Math.round((relationsAccepted / relationsSent) * 100);

  const takeRate = Number(process.env.BUUPP_TAKE_RATE ?? "0.20") || 0.2;
  const estimatedRevenueCents = Math.round((raw.campaignChargeCents ?? 0) * takeRate);

  return {
    waitlist: waitlistRes.count ?? 0,
    prospects: prospectsRes.count ?? 0,
    pros: prosRes.count ?? 0,
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
