/**
 * GET /api/admin/stats/overview/timeseries?period=<key>
 * Renvoie les points de la série temporelle selon la période demandée.
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";
import { fetchOverviewTimeseries } from "@/lib/admin/queries/overview-timeseries";
import { rateLimit } from "@/lib/admin/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const raw = url.searchParams.get("period") ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey) : ("30d" as PeriodKey);

  const range = rangeFor(period, new Date());
  const points = await fetchOverviewTimeseries(range);
  return NextResponse.json({ period, points }, { headers: { "cache-control": "no-store" } });
}
