// lib/admin/queries/pros.ts
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/admin/periods";

export type ProsKpis = {
  signups: number;
  byPlan: Record<string, number>;
  byBilling: Record<string, number>;
  topSecteurs: { secteur: string; n: number }[];
  topVilles: { ville: string; n: number }[];
  topupCount: number;
  topupEur: number;
  topupAvgEur: number;
  walletBalanceEur: number;
  revealsCount: number;
  revealsPerDay: Record<string, number>;
};

export async function fetchProsKpis(range: DateRange): Promise<ProsKpis> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_pros_kpis", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) throw error;
  return data as unknown as ProsKpis;
}
