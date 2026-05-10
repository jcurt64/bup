// lib/admin/queries/campaigns.ts
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/admin/periods";

export type CampaignsKpis = {
  byStatus: Record<string, number>;
  created: number;
  budgetEur: number;
  spentEur: number;
  consumptionAvgPct: number;
  cpcAvgEur: number;
  cpcMedianEur: number;
  byType: Record<string, number>;
  topGeo: { geo: string; n: number }[];
  topCategories: { cat: string; n: number }[];
  topPerf: { id: string; name: string; pct: number }[];
  flopPerf: { id: string; name: string; pct: number }[];
  autoCompleted: number;
  expiringWarned: number;
};

export async function fetchCampaignsKpis(range: DateRange): Promise<CampaignsKpis> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_campaigns_kpis", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) throw error;
  return data as unknown as CampaignsKpis;
}
