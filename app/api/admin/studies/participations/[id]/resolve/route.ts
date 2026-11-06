/**
 * POST /api/admin/studies/participations/:id/resolve
 *   { decision: 'approve' | 'reject_final' } — arbitrage d'une contestation
 *   (ou d'une participation conservée après suspension).
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { notifyDispute } from "@/lib/studies/notify";
import { sweepStudy } from "@/lib/studies/sweep";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { decision?: string };
  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from("study_participations").select("id, status, campaign_id").eq("id", id).maybeSingle();
  if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!["disputed", "done", "rejected"].includes(p.status)) {
    return NextResponse.json({ error: "not_resolvable" }, { status: 409 });
  }
  if (body.decision === "approve") {
    const { data, error } = await admin.rpc("approve_study_participation_tx", { p_participation: id, p_by: "admin" });
    if (error || !data) return NextResponse.json({ error: error?.message ?? "approve_failed" }, { status: 409 });
    if (p.status === "disputed") await notifyDispute(admin, id, "approved");
  } else if (body.decision === "reject_final") {
    // Garde de statut dans l'UPDATE : si la participation a été payée entre-temps
    // (auto-validation), on ne la repasse pas en refusée.
    const { data: upd } = await admin.from("study_participations")
      .update({ status: "rejected_final", resolved_at: new Date().toISOString() })
      .eq("id", id).in("status", ["disputed", "done", "rejected"]).select("id");
    if (!upd?.length) return NextResponse.json({ error: "not_resolvable" }, { status: 409 });
    if (p.status === "disputed") await notifyDispute(admin, id, "rejected");
  } else {
    return NextResponse.json({ error: "decision_invalid" }, { status: 400 });
  }
  await sweepStudy(admin, p.campaign_id); // clôture / libération si plus rien en attente
  return NextResponse.json({ ok: true });
}
