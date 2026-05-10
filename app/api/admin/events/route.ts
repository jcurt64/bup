/**
 * GET /api/admin/events?since=<iso>&severity=&limit=
 * Liste paginée des events admin. `since` filtre `created_at > since`.
 * Plafond 100 par appel.
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
  const since = url.searchParams.get("since");
  const severity = url.searchParams.get("severity");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));

  const admin = createSupabaseAdminClient();
  let q = admin.from("admin_events").select("*").order("created_at", { ascending: false }).limit(limit);
  if (since) q = q.gt("created_at", since);
  if (severity) q = q.eq("severity", severity as never);
  const { data, error } = await q;
  if (error) {
    console.error("[/api/admin/events] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  return NextResponse.json({ events: data ?? [] }, { headers: { "cache-control": "no-store" } });
}
