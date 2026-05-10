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

  const takeRate = Number(process.env.BUUPP_TAKE_RATE ?? "0.20") || 0.2;
  const estimatedRevenueCents = Math.round((raw.campaignChargeCents ?? 0) * takeRate);

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
