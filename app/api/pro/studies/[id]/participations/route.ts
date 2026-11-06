/**
 * POST /api/pro/studies/:id/participations
 *   { ids: string[], action: 'approve' } → débit (rémunération + commission) + crédit prospect.
 *   { ids: string[], action: 'reject', reason, note? } → refus motivé (contestable 7 j).
 */
import { NextResponse, after } from "next/server";
import { requirePro, readJson, err } from "@/lib/studies/http";
import { canProApprove, canProReject } from "@/lib/studies/status";
import { notifyApproved, notifyRejected } from "@/lib/studies/notify";
import { REJECT_NOTE_MAX, REJECT_REASONS } from "@/lib/studies/constants";
import { sweepStudy } from "@/lib/studies/sweep";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const g = await requirePro();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const body = await readJson(req);
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 500) : [];
  if (!ids.length) return err("ids_required", 400);

  await sweepStudy(g.admin, id);
  const { data: c } = await g.admin.from("study_campaigns")
    .select("id, status, signup_deadline, completion_deadline").eq("id", id).eq("pro_account_id", g.proId).maybeSingle();
  if (!c) return err("not_found", 404);
  const { data: parts } = await g.admin.from("study_participations")
    .select("id, status, review_due_at").eq("campaign_id", id).in("id", ids);
  const now = new Date();
  const done: string[] = [];
  const skipped: string[] = [];

  if (body.action === "approve") {
    for (const p of parts ?? []) {
      if (!canProApprove(c, p, now)) { skipped.push(p.id); continue; }
      const { data, error } = await g.admin.rpc("approve_study_participation_tx", { p_participation: p.id, p_by: "pro" });
      if (error || !data) { skipped.push(p.id); continue; }
      done.push(p.id);
    }
    after(async () => { for (const pid of done) await notifyApproved(g.admin, pid); });
    return NextResponse.json({ ok: true, approved: done, skipped });
  }

  if (body.action === "reject") {
    const reason = String(body.reason ?? "");
    if (!(reason in REJECT_REASONS)) return err("reason_invalid", 400);
    const note = typeof body.note === "string" ? body.note.trim().slice(0, REJECT_NOTE_MAX) : "";
    if (reason === "other" && note.length < 3) return err("note_required", 400);
    for (const p of parts ?? []) {
      if (!canProReject(c, p, now)) { skipped.push(p.id); continue; }
      const { error } = await g.admin.from("study_participations").update({
        status: "rejected", rejected_at: now.toISOString(), reject_reason: reason, reject_note: note || null,
      }).eq("id", p.id).eq("status", "done");
      if (error) { skipped.push(p.id); continue; }
      done.push(p.id);
    }
    after(async () => { for (const pid of done) await notifyRejected(g.admin, pid); });
    return NextResponse.json({ ok: true, rejected: done, skipped });
  }

  return err("action_invalid", 400);
}
