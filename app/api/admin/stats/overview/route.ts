/**
 * GET /api/admin/stats/overview?period=<today|7d|30d|quarter|12m|all>
 * Renvoie les KPIs courants + ceux de la période précédente (pour delta).
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { fetchOverviewKpis } from "@/lib/admin/queries/overview";
import { PERIOD_KEYS, rangeFor, previousRangeOf, type PeriodKey } from "@/lib/admin/periods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const raw = url.searchParams.get("period") ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey)
    : ("30d" as PeriodKey);

  const now = new Date();
  const cur = rangeFor(period, now);
  const prev = previousRangeOf(cur);

  const [current, previous] = await Promise.all([
    fetchOverviewKpis(cur),
    fetchOverviewKpis(prev),
  ]);

  return NextResponse.json(
    { period, current, previous },
    { headers: { "cache-control": "no-store" } },
  );
}
