/** POST /api/admin/studies/:id/suspend — suspension admin (spec §8). */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { notifyCanceled } from "@/lib/studies/notify";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const admin = createSupabaseAdminClient();
  const { data: c } = await admin.from("study_campaigns").select("id, title, pro_account_id, status").eq("id", id).maybeSingle();
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Prospects dont l'inscription sera supprimée (les participations déclarées faites sont conservées).
  const { data: parts } = await admin.from("study_participations").select("prospect_id")
    .eq("campaign_id", id).in("status", ["joined", "confirmed", "not_done"]);
  const { data: released, error } = await admin.rpc("cancel_study_tx", { p_id: id, p_reason: "admin_suspended" });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  await notifyCanceled(admin, c, (parts ?? []).map((p) => p.prospect_id), "admin_suspended");
  return NextResponse.json({ ok: true, releasedCents: Number(released ?? 0) });
}
