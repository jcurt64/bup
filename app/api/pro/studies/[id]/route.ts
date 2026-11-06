/**
 * /api/pro/studies/:id
 *  GET   : détail + participants (prénom, alias, code, statut) une fois la campagne validée.
 *  PATCH : modification d'un brouillon.
 *  POST  : { action: 'publish', fraudTermsAccepted: true } | { action: 'cancel' } (avant validation, sans frais).
 */
import { NextResponse, after } from "next/server";
import { requirePro, readJson, err, rpcErrorCode } from "@/lib/studies/http";
import { validateStudyInput } from "@/lib/studies/validate";
import { sweepStudy } from "@/lib/studies/sweep";
import { countJoined } from "@/lib/studies/repo";
import { studyBadge } from "@/lib/studies/status";
import { toProParticipant } from "@/lib/studies/mappers";
import { publishOrDraft } from "@/lib/studies/publish";
import { notifyCanceled } from "@/lib/studies/notify";
import { getOrCreateStudyAlias, buildAliasAddress } from "@/lib/aliases/relation-email";
import { commissionCents } from "@/lib/pricing/commission";
import { STUDY_TYPE_LABELS, type StudyType } from "@/lib/studies/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function own(g: { admin: Parameters<typeof sweepStudy>[0]; proId: string }, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await g.admin.from("study_campaigns").select("*").eq("id", id).eq("pro_account_id", g.proId).maybeSingle();
  return data;
}

export async function GET(_req: Request, ctx: Ctx) {
  const g = await requirePro();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  if (!(await own(g, id))) return err("not_found", 404);
  await sweepStudy(g.admin, id);
  const c = (await own(g, id))!;
  const joined = (await countJoined(g.admin, [id])).get(id) ?? 0;
  const unit = Number(c.reward_cents) + commissionCents(Number(c.reward_cents));

  let participants: ReturnType<typeof toProParticipant>[] = [];
  const revealed = c.status === "validated" || c.status === "closed" || (c.status === "canceled" && c.validated_at);
  if (revealed) {
    const { data: parts } = await g.admin.from("study_participations")
      .select("id, prospect_id, status, code, done_comment, done_at, review_due_at")
      .eq("campaign_id", id).order("created_at", { ascending: true });
    const ids = (parts ?? []).map((p) => p.prospect_id);
    const { data: idents } = ids.length
      ? await g.admin.from("prospect_identity").select("prospect_id, prenom").in("prospect_id", ids)
      : { data: [] };
    const prenom = new Map((idents ?? []).map((r) => [r.prospect_id, r.prenom?.trim() || null]));
    participants = await Promise.all((parts ?? []).map(async (p) => {
      let alias: string | null = null;
      if (!c.purged_at) {
        try { alias = buildAliasAddress(await getOrCreateStudyAlias(g.admin, p.id)); } catch { alias = null; }
      }
      return toProParticipant({ ...p, prenom: prenom.get(p.prospect_id) ?? null, alias });
    }));
  }

  const approved = participants.filter((p) => p.status === "approved").length;
  return NextResponse.json({
    study: {
      id: c.id, type: c.type, typeLabel: STUDY_TYPE_LABELS[c.type as StudyType] ?? c.type,
      title: c.title, description: c.description, estimatedMinutes: c.estimated_minutes,
      externalUrl: c.external_url, address: c.address,
      rewardCents: Number(c.reward_cents), unitCostCents: unit,
      min: c.min_participants, max: c.max_participants, joinedCount: joined,
      scope: c.scope, department: c.department,
      signupDeadline: c.signup_deadline, completionDeadline: c.completion_deadline,
      status: c.status, cancelReason: c.cancel_reason,
      budgetReservedCents: Number(c.budget_reserved_cents),
      spentCents: approved * unit,
      badge: studyBadge({ status: c.status, joinedCount: joined, min: c.min_participants, max: c.max_participants }),
    },
    participants,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const g = await requirePro();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const c = await own(g, id);
  if (!c) return err("not_found", 404);
  if (c.status !== "draft") return err("not_draft", 409);
  const body = await readJson(req);
  const v = validateStudyInput(body, new Date());
  if (!v.ok) return err(v.error, 400);
  const s = v.value;
  await g.admin.from("study_campaigns").update({
    type: s.type, title: s.title, description: s.description, estimated_minutes: s.estimatedMinutes,
    external_url: s.externalUrl, address: s.address, reward_cents: s.rewardCents,
    commission_cents: commissionCents(s.rewardCents),
    min_participants: s.minParticipants, max_participants: s.maxParticipants,
    scope: s.scope, department: s.department,
    signup_deadline: s.signupDeadline, completion_deadline: s.completionDeadline,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft");
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await requirePro();
  if (!g.ok) return g.res;
  const { id } = await ctx.params;
  const c = await own(g, id);
  if (!c) return err("not_found", 404);
  const body = await readJson(req);

  if (body.action === "publish") {
    if (c.status !== "draft") return err("not_draft", 409);
    if (body.fraudTermsAccepted !== true && !c.fraud_terms_accepted_at) return err("fraud_terms_required", 400);
    if (!c.fraud_terms_accepted_at) {
      await g.admin.from("study_campaigns").update({ fraud_terms_accepted_at: new Date().toISOString() }).eq("id", id);
    }
    return publishOrDraft(g.admin, c);
  }

  if (body.action === "cancel") {
    // Applique d'abord les échéances : une campagne arrivée à sa date limite
    // avec assez d'inscrits doit être validée, pas annulable.
    await sweepStudy(g.admin, id);
    const fresh = await own(g, id);
    if (!fresh || (fresh.status !== "draft" && fresh.status !== "published")) return err("not_cancelable", 409);
    const { data: parts } = await g.admin.from("study_participations").select("prospect_id").eq("campaign_id", id);
    const { data: released, error } = await g.admin.rpc("cancel_study_tx", { p_id: id, p_reason: "pro_canceled" });
    if (error) return err(rpcErrorCode(error), 409);
    if (released === null) return err("not_cancelable", 409);
    const pids = (parts ?? []).map((p) => p.prospect_id);
    if (pids.length) after(() => notifyCanceled(g.admin, c, pids, "pro_canceled"));
    return NextResponse.json({ ok: true, releasedCents: Number(released ?? 0) });
  }

  return err("action_invalid", 400);
}
