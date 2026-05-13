/**
 * GET /api/admin/reports — Liste filtrée des signalements pour le
 * back-office. Garde admin (Clerk allowlist + x-admin-secret).
 *
 * Query params :
 *   status : 'open' | 'resolved' | 'all'   (défaut 'open')
 *   reason : 'all' | 'sollicitation_multiple' | 'faux_compte' | 'echange_abusif' (défaut 'all')
 *   period : '7d' | '30d' | '90d' | 'all'  (défaut '30d')
 *   page   : number                         (défaut 0)
 */

import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import {
  fetchReportsList,
  type ReportStatus,
  type ReportReason,
  type ReportPeriod,
} from "@/lib/admin/queries/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS: ReportStatus[] = ["open", "resolved", "all"];
const VALID_REASON: ReportReason[] = [
  "all",
  "sollicitation_multiple",
  "faux_compte",
  "echange_abusif",
];
const VALID_PERIOD: ReportPeriod[] = ["7d", "30d", "90d", "all"];

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "open") as ReportStatus;
  const reason = (url.searchParams.get("reason") ?? "all") as ReportReason;
  const period = (url.searchParams.get("period") ?? "30d") as ReportPeriod;
  const pageRaw = Number(url.searchParams.get("page") ?? "0");
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;

  if (!VALID_STATUS.includes(status))
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  if (!VALID_REASON.includes(reason))
    return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
  if (!VALID_PERIOD.includes(period))
    return NextResponse.json({ error: "invalid_period" }, { status: 400 });

  const items = await fetchReportsList({ status, reason, period, page });
  return NextResponse.json({ items });
}
