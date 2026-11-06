/** POST /api/studies/:id/report — signalement d'une campagne (1 par prospect). Alerte admin à 3. */
import { NextResponse, after } from "next/server";
import { requireProspect, readJson, err } from "@/lib/studies/http";
import { REPORT_ALERT_THRESHOLD, REPORT_REASONS } from "@/lib/studies/constants";
import { sendAdminCriticalAlert } from "@/lib/email/admin-alert";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const g = await requireProspect();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const body = await readJson(req);
  const reason = String(body.reason ?? "");
  if (!Object.hasOwn(REPORT_REASONS, reason)) return err("reason_invalid", 400);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) || null : null;
  const { data: c } = await g.admin.from("study_campaigns").select("id, title").eq("id", id).maybeSingle();
  if (!c) return err("not_found", 404);
  const { error } = await g.admin.from("study_reports").insert({ campaign_id: id, prospect_id: g.ctx.prospectId, reason, note });
  if (error) return err(error.code === "23505" ? "already_reported" : "report_failed", error.code === "23505" ? 409 : 500);
  const { count } = await g.admin.from("study_reports").select("id", { count: "exact", head: true }).eq("campaign_id", id);
  if (count === REPORT_ALERT_THRESHOLD) {
    after(() => sendAdminCriticalAlert({
      type: "studies.reports_threshold",
      payload: { campaignId: id, title: c.title, reports: count },
      createdAt: new Date().toISOString(),
    }));
  }
  return NextResponse.json({ ok: true });
}
