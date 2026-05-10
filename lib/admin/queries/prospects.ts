/**
 * Lit les agrégats Prospects via la RPC `admin_prospects_kpis`.
 * Les distributions sont globales ; les compteurs périodiques respectent
 * la fenêtre p_start/p_end (cf. SQL).
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/admin/periods";

export type ProspectsKpis = {
  funnel: { waitlist: number; signup: number; tier1: number; phone: number; firstAccept: number; firstWithdrawal: number };
  paliers: Record<string, number>;
  scoreBuckets: Record<string, number>;
  verification: Record<string, number>;
  phoneVerifiedPct: number;
  topVilles: { ville: string; n: number }[];
  topSecteurs: { secteur: string; n: number }[];
  refusalReasons: { reason: string; n: number }[];
  founders: number;
  foundersBonusCount: number;
  foundersBonusEur: number;
  creditedEur: number;
  withdrawalsCount: number;
  withdrawalsEur: number;
  topReferrers: { refCode: string; n: number }[];
};

export async function fetchProspectsKpis(range: DateRange): Promise<ProspectsKpis> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_prospects_kpis", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) throw error;
  return data as unknown as ProspectsKpis;
}
