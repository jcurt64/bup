// app/api/admin/stats/pros/list/route.ts
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? "25")));
  const plan = url.searchParams.get("plan");
  const billing = url.searchParams.get("billing");
  const secteur = url.searchParams.get("secteur");

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("pro_accounts")
    .select("id, raison_sociale, siren, secteur, ville, plan, billing_status, wallet_balance_cents, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  if (plan) query = query.eq("plan", plan as never);
  if (billing) query = query.eq("billing_status", billing as never);
  if (secteur) query = query.eq("secteur", secteur as never);

  const { data, error, count } = await query;
  if (error) {
    console.error("[/api/admin/stats/pros/list] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  return NextResponse.json({ page, size, total: count ?? 0, rows: data ?? [] });
}
