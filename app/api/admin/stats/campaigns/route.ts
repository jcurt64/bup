// app/api/admin/stats/campaigns/route.ts
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";
import { fetchCampaignsKpis } from "@/lib/admin/queries/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const raw = url.searchParams.get("period") ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey) : ("30d" as PeriodKey);
  const data = await fetchCampaignsKpis(rangeFor(period, new Date()));
  return NextResponse.json({ period, ...data }, { headers: { "cache-control": "no-store" } });
}
