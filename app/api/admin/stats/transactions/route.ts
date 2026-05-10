/**
 * GET /api/admin/stats/transactions?accountKind=&type=&status=&from=&to=&minEur=&maxEur=&page=&size=
 * Plafond 50 lignes par page.
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/admin/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? "25")));
  const accountKind = url.searchParams.get("accountKind");
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const minEur = url.searchParams.get("minEur");
  const maxEur = url.searchParams.get("maxEur");

  const admin = createSupabaseAdminClient();
  let q = admin.from("transactions").select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);

  if (accountKind) q = q.eq("account_kind", accountKind as never);
  if (type) q = q.eq("type", type as never);
  if (status) q = q.eq("status", status as never);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);
  if (minEur) q = q.gte("amount_cents", Math.round(Number(minEur) * 100));
  if (maxEur) q = q.lte("amount_cents", Math.round(Number(maxEur) * 100));

  const { data, error, count } = await q;
  if (error) {
    console.error("[/api/admin/stats/transactions] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  return NextResponse.json({ page, size, total: count ?? 0, rows: data ?? [] });
}
