/**
 * /api/pro/studies — campagnes Tests & Études du pro.
 *  GET  : liste (jauge, statut, coûts engagés/réservés).
 *  POST : création { ...StudyInput, fraudTermsAccepted, publish?: boolean }.
 *         publish=true → réservation du budget max (402 insufficient_funds si solde dispo insuffisant).
 */
import { NextResponse } from "next/server";
import { requirePro, readJson, err } from "@/lib/studies/http";
import { validateStudyInput } from "@/lib/studies/validate";
import { commissionCents } from "@/lib/pricing/commission";
import { countJoined } from "@/lib/studies/repo";
import { sweepStudies } from "@/lib/studies/sweep";
import { studyBadge } from "@/lib/studies/status";
import { publishOrDraft } from "@/lib/studies/publish";
import { STUDY_TYPE_LABELS, type StudyType } from "@/lib/studies/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requirePro();
  if (!g.ok) return g.res;
  const { data: pre } = await g.admin.from("study_campaigns").select("id").eq("pro_account_id", g.proId);
  await sweepStudies(g.admin, (pre ?? []).map((r) => r.id));
  const { data } = await g.admin.from("study_campaigns").select("*")
    .eq("pro_account_id", g.proId).order("created_at", { ascending: false }).limit(200);
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const [counts, approved, toReview] = await Promise.all([
    countJoined(g.admin, ids),
    countJoined(g.admin, ids, "approved"),
    countJoined(g.admin, ids, "done"),
  ]);

  return NextResponse.json({
    items: rows.map((r) => {
      const joined = counts.get(r.id) ?? 0;
      const unit = Number(r.reward_cents) + commissionCents(Number(r.reward_cents));
      return {
        id: r.id, type: r.type, typeLabel: STUDY_TYPE_LABELS[r.type as StudyType] ?? r.type, title: r.title,
        status: r.status, cancelReason: r.cancel_reason, rewardCents: Number(r.reward_cents), unitCostCents: unit,
        min: r.min_participants, max: r.max_participants, joinedCount: joined,
        scope: r.scope, department: r.department,
        signupDeadline: r.signup_deadline, completionDeadline: r.completion_deadline,
        budgetReservedCents: Number(r.budget_reserved_cents),
        spentCents: (approved.get(r.id) ?? 0) * unit,
        approvedCount: approved.get(r.id) ?? 0,
        toReviewCount: toReview.get(r.id) ?? 0,
        badge: studyBadge({ status: r.status, joinedCount: joined, min: r.min_participants, max: r.max_participants }),
        createdAt: r.created_at,
      };
    }),
  });
}

export async function POST(req: Request) {
  const g = await requirePro();
  if (!g.ok) return g.res;
  const body = await readJson(req);
  const v = validateStudyInput(body, new Date());
  if (!v.ok) return err(v.error, 400);
  const publish = body.publish === true;
  if (publish && body.fraudTermsAccepted !== true) return err("fraud_terms_required", 400);

  const { data: pro } = await g.admin.from("pro_accounts").select("raison_sociale").eq("id", g.proId).single();
  if (!pro?.raison_sociale?.trim()) return err("raison_sociale_required", 422);

  const s = v.value;
  const { data: row, error } = await g.admin.from("study_campaigns").insert({
    pro_account_id: g.proId, type: s.type, title: s.title, description: s.description,
    estimated_minutes: s.estimatedMinutes, external_url: s.externalUrl, address: s.address,
    reward_cents: s.rewardCents, commission_cents: commissionCents(s.rewardCents),
    min_participants: s.minParticipants, max_participants: s.maxParticipants,
    scope: s.scope, department: s.department,
    signup_deadline: s.signupDeadline, completion_deadline: s.completionDeadline,
    fraud_terms_accepted_at: body.fraudTermsAccepted === true ? new Date().toISOString() : null,
  }).select("id, scope, department").single();
  if (error || !row) return err("create_failed", 500);

  if (!publish) return NextResponse.json({ id: row.id, status: "draft" });
  return publishOrDraft(g.admin, row);
}
