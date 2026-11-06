/** POST /api/studies/:id/done — « J'ai terminé » (+ commentaire facultatif). Démarre la revue de 7 j. */
import { NextResponse } from "next/server";
import { requireProspect, readJson, err } from "@/lib/studies/http";
import { canMarkDone } from "@/lib/studies/status";
import { sweepStudy } from "@/lib/studies/sweep";
import { DAY_MS, DONE_COMMENT_MAX, REVIEW_DAYS } from "@/lib/studies/constants";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const g = await requireProspect();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const body = await readJson(req);
  await sweepStudy(g.admin, id);
  const [{ data: c }, { data: p }] = await Promise.all([
    g.admin.from("study_campaigns").select("status, signup_deadline, completion_deadline").eq("id", id).maybeSingle(),
    g.admin.from("study_participations").select("id, status").eq("campaign_id", id).eq("prospect_id", g.ctx.prospectId).maybeSingle(),
  ]);
  if (!c || !p) return err("not_found", 404);
  const now = new Date();
  if (!canMarkDone(c, p, now)) return err("not_markable", 409);
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, DONE_COMMENT_MAX) : "";
  await g.admin.from("study_participations").update({
    status: "done",
    done_at: now.toISOString(),
    done_comment: comment || null,
    review_due_at: new Date(now.getTime() + REVIEW_DAYS * DAY_MS).toISOString(),
  }).eq("id", p.id).eq("status", "confirmed");
  return NextResponse.json({ ok: true });
}
