/** POST /api/studies/:id/withdraw — retrait tant que la campagne n'est pas validée (ligne supprimée). */
import { NextResponse } from "next/server";
import { requireProspect, err } from "@/lib/studies/http";
import { canWithdraw } from "@/lib/studies/status";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const g = await requireProspect();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const [{ data: c }, { data: p }] = await Promise.all([
    g.admin.from("study_campaigns").select("status, signup_deadline, completion_deadline").eq("id", id).maybeSingle(),
    g.admin.from("study_participations").select("id, status").eq("campaign_id", id).eq("prospect_id", g.ctx.prospectId).maybeSingle(),
  ]);
  if (!c || !p) return err("not_found", 404);
  if (!canWithdraw(c, p)) return err("not_withdrawable", 409);
  await g.admin.from("study_participations").delete().eq("id", p.id).eq("status", "joined");
  return NextResponse.json({ ok: true });
}
