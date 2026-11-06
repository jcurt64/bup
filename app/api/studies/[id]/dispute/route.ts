/** POST /api/studies/:id/dispute — contestation d'un refus sous 7 j (BUUPP tranche). */
import { NextResponse, after } from "next/server";
import { requireProspect, readJson, err } from "@/lib/studies/http";
import { canDispute } from "@/lib/studies/status";
import { notifyDispute } from "@/lib/studies/notify";
import { DISPUTE_NOTE_MAX } from "@/lib/studies/constants";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const g = await requireProspect();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const body = await readJson(req);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, DISPUTE_NOTE_MAX) : "";
  if (note.length < 10) return err("note_required", 400);
  const { data: p } = await g.admin.from("study_participations")
    .select("id, status, rejected_at").eq("campaign_id", id).eq("prospect_id", g.ctx.prospectId).maybeSingle();
  if (!p) return err("not_found", 404);
  if (!canDispute(p, new Date())) return err("not_disputable", 409);
  await g.admin.from("study_participations").update({
    status: "disputed", disputed_at: new Date().toISOString(), dispute_note: note,
  }).eq("id", p.id).eq("status", "rejected");
  after(() => notifyDispute(g.admin, p.id, "opened"));
  return NextResponse.json({ ok: true });
}
