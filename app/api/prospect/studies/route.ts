/**
 * /api/prospect/studies — espace prospect « Tests & Études ».
 *  GET   : mes participations, notifications (nouvelles campagnes, validations…), préférence e-mail.
 *  PATCH : { emailDigest?: boolean, markRead?: true }.
 */
import { NextResponse } from "next/server";
import { requireProspect, readJson } from "@/lib/studies/http";
import { sweepStudies } from "@/lib/studies/sweep";
import { STUDY_TYPE_LABELS, type StudyType } from "@/lib/studies/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireProspect();
  if (!g.ok) return g.res;
  const { admin, ctx } = g;

  const { data: pre } = await admin.from("study_participations").select("campaign_id").eq("prospect_id", ctx.prospectId);
  await sweepStudies(admin, (pre ?? []).map((p) => p.campaign_id));

  const [{ data: parts }, { data: notifs }, { data: prefs }] = await Promise.all([
    admin.from("study_participations")
      .select("id, campaign_id, status, code, done_at, done_comment, review_due_at, approved_at, rejected_at, reject_reason, reject_note, disputed_at, created_at")
      .eq("prospect_id", ctx.prospectId).order("created_at", { ascending: false }).limit(100),
    admin.from("study_notifications").select("id, campaign_id, kind, created_at, read_at")
      .eq("prospect_id", ctx.prospectId).order("created_at", { ascending: false }).limit(30),
    admin.from("prospects").select("studies_email_digest").eq("id", ctx.prospectId).single(),
  ]);

  const campIds = [...new Set([...(parts ?? []).map((p) => p.campaign_id), ...(notifs ?? []).map((n) => n.campaign_id)])];
  const { data: camps } = campIds.length
    ? await admin.from("study_campaigns")
        .select("id, type, title, reward_cents, status, signup_deadline, completion_deadline, external_url, address, pro_account_id")
        .in("id", campIds)
    : { data: [] };
  const { data: pros } = camps?.length
    ? await admin.from("pro_accounts").select("id, raison_sociale").in("id", [...new Set(camps.map((c) => c.pro_account_id))])
    : { data: [] };
  const proName = new Map((pros ?? []).map((p) => [p.id, p.raison_sociale?.trim() || "Un professionnel"]));
  const byId = new Map((camps ?? []).map((c) => [c.id, c]));

  const participations = (parts ?? []).map((p) => {
    const c = byId.get(p.campaign_id);
    const revealed = p.status !== "joined";
    return {
      ...p,
      campaign: c && {
        id: c.id,
        title: c.title,
        typeLabel: STUDY_TYPE_LABELS[c.type as StudyType] ?? c.type,
        rewardCents: Number(c.reward_cents),
        status: c.status,
        signupDeadline: c.signup_deadline,
        completionDeadline: c.completion_deadline,
        proName: proName.get(c.pro_account_id) ?? "Un professionnel",
        externalUrl: revealed ? c.external_url : null,
        address: revealed ? c.address : null,
      },
    };
  });
  const notifications = (notifs ?? []).map((n) => {
    const c = byId.get(n.campaign_id);
    return { ...n, title: c?.title ?? "Campagne", rewardCents: c ? Number(c.reward_cents) : 0, campaignStatus: c?.status ?? null };
  });

  return NextResponse.json({
    participations,
    notifications,
    unreadCount: notifications.filter((n) => !n.read_at).length,
    emailDigest: Boolean(prefs?.studies_email_digest),

  });
}

export async function PATCH(req: Request) {
  const g = await requireProspect();
  if (!g.ok) return g.res;
  const body = await readJson(req);
  if (typeof body.emailDigest === "boolean") {
    await g.admin.from("prospects").update({ studies_email_digest: body.emailDigest }).eq("id", g.ctx.prospectId);
  }
  if (body.markRead === true) {
    await g.admin.from("study_notifications").update({ read_at: new Date().toISOString() })
      .eq("prospect_id", g.ctx.prospectId).is("read_at", null);
  }
  return NextResponse.json({ ok: true });
}
