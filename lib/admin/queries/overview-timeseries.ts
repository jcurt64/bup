/**
 * Agrège les rows quotidiennes de `admin_overview_timeseries` selon les
 * buckets demandés (jour/semaine/mois) côté Node — la RPC reste en jour
 * pour rester simple et indexable.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { bucketize, type DateRange, type Bucket } from "@/lib/admin/periods";

export type OverviewSeriesPoint = {
  label: string;
  prospects: number;
  pros: number;
  relationsSent: number;
  relationsAccepted: number;
  relationsRefused: number;
  relationsExpired: number;
  budgetCents: number;
  spentCents: number;
  creditedCents: number;
};

export async function fetchOverviewTimeseries(
  range: DateRange,
): Promise<OverviewSeriesPoint[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_overview_timeseries", {
    p_start: range.start.toISOString(),
    p_end: range.end.toISOString(),
  });
  if (error) {
    console.error("[admin/queries/overview-timeseries] rpc failed", error);
    throw error;
  }

  const buckets = bucketize(range);
  return buckets.map((b) => mergeRowsForBucket(b, (data ?? []) as DailyRow[]));
}

type DailyRow = {
  d: string;
  prospects: number;
  pros: number;
  relations_sent: number;
  relations_accepted: number;
  relations_refused: number;
  relations_expired: number;
  budget_cents: number | string;
  spent_cents: number | string;
  credited_cents: number | string;
};

function mergeRowsForBucket(b: Bucket, rows: DailyRow[]): OverviewSeriesPoint {
  let prospects = 0, pros = 0;
  let relationsSent = 0, relationsAccepted = 0, relationsRefused = 0, relationsExpired = 0;
  let budgetCents = 0, spentCents = 0, creditedCents = 0;
  for (const r of rows) {
    const t = new Date(r.d).getTime();
    if (t < b.start.getTime() || t >= b.end.getTime()) continue;
    prospects += r.prospects;
    pros += r.pros;
    relationsSent += r.relations_sent;
    relationsAccepted += r.relations_accepted;
    relationsRefused += r.relations_refused;
    relationsExpired += r.relations_expired;
    budgetCents += Number(r.budget_cents);
    spentCents += Number(r.spent_cents);
    creditedCents += Number(r.credited_cents);
  }
  return {
    label: b.label,
    prospects, pros,
    relationsSent, relationsAccepted, relationsRefused, relationsExpired,
    budgetCents, spentCents, creditedCents,
  };
}
