/** POST /api/studies/:id/join — inscription avec consentement explicite. */
import { NextResponse, after } from "next/server";
import { requireProspect, readJson, err, rpcErrorCode } from "@/lib/studies/http";
import { sweepStudy } from "@/lib/studies/sweep";
import { notifyValidated } from "@/lib/studies/notify";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const g = await requireProspect();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const body = await readJson(req);
  if (body.consent !== true) return err("consent_required", 400);
  if (!g.ctx.prenom || !g.ctx.email) return err("tier1_incomplete", 422);

  await sweepStudy(g.admin, id);
  const { data: c } = await g.admin.from("study_campaigns").select("scope, department").eq("id", id).maybeSingle();
  if (!c) return err("not_found", 404);
  if (c.scope === "department" && g.ctx.department !== c.department) return err("out_of_area", 403);

  const { data, error } = await g.admin.rpc("join_study_tx", { p_campaign: id, p_prospect: g.ctx.prospectId });
  if (error) {
    const code = rpcErrorCode(error);
    return err(code, code === "not_found" ? 404 : 409);
  }
  if (data === "joined_validated") after(() => notifyValidated(g.admin, id));
  return NextResponse.json({ ok: true, result: data });
}
