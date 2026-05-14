/**
 * POST /api/admin/reports/[id]/notify-pro
 * Body : aucun (l'admin clique le bouton sans saisie supplémentaire — le
 * contenu du mail est déterminé par le motif du signalement).
 *
 * Garde admin (Clerk allowlist OU x-admin-secret).
 *
 * Effet :
 *   1. Lit le signalement + jointures (pro, campagne, relation).
 *   2. Récupère l'email du pro depuis Clerk (clerk_user_id).
 *   3. Envoie l'email d'avertissement (template lib/email/pro-report-warning).
 *   4. Persiste notified_at + notified_by_clerk_id sur le signalement.
 *   5. Émet un admin_event admin.report_pro_notified.
 *
 * Idempotence : si notified_at est déjà set, renvoie 409 already_notified
 * pour éviter le spam si l'admin re-clique.
 */

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@/lib/clerk/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { recordEvent } from "@/lib/admin/events/record";
import {
  sendProReportWarning,
  type ProReportWarningReason,
} from "@/lib/email/pro-report-warning";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const { userId: adminClerkId } = await auth();
  const { id: reportId } = await ctx.params;
  if (!reportId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: report, error: readErr } = await admin
    .from("relation_reports")
    .select(
      `id, reason, notified_at, pro_account_id, relation_id, prospect_id,
       pro_accounts ( id, raison_sociale, clerk_user_id ),
       relations ( id, sent_at, campaign_id, campaigns ( id, name ) )`,
    )
    .eq("id", reportId)
    .maybeSingle();
  if (readErr) {
    console.error("[/api/admin/reports/[id]/notify-pro] read failed", readErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: "report_not_found" }, { status: 404 });
  }
  if (report.notified_at) {
    return NextResponse.json({ error: "already_notified" }, { status: 409 });
  }

  const proRow = Array.isArray(report.pro_accounts)
    ? report.pro_accounts[0]
    : report.pro_accounts;
  const clerkUserId = proRow?.clerk_user_id ?? null;
  if (!clerkUserId) {
    return NextResponse.json({ error: "pro_not_linked" }, { status: 422 });
  }

  let proEmail: string | null = null;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    const primary = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    );
    proEmail = primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  } catch (err) {
    console.error("[/api/admin/reports/[id]/notify-pro] clerk getUser failed", err);
    return NextResponse.json({ error: "pro_email_lookup_failed" }, { status: 502 });
  }
  if (!proEmail) {
    return NextResponse.json({ error: "pro_email_missing" }, { status: 422 });
  }

  const relationRow = Array.isArray(report.relations)
    ? report.relations[0]
    : report.relations;
  const campaignRow = relationRow?.campaigns
    ? Array.isArray(relationRow.campaigns)
      ? relationRow.campaigns[0]
      : relationRow.campaigns
    : null;

  const result = await sendProReportWarning({
    email: proEmail,
    proName: proRow?.raison_sociale ?? "—",
    reason: report.reason as ProReportWarningReason,
    campaignName: campaignRow?.name ?? null,
    sentAt: relationRow?.sent_at ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "email_send_failed" }, { status: 502 });
  }

  // Persistance succès — si l'UPDATE échoue, on log mais on renvoie 200
  // quand même : l'email est parti, l'admin ne doit pas re-cliquer pour
  // autant. Le risque d'un re-clic non bloqué reste limité (un seul admin
  // physique).
  const { error: updateErr } = await admin
    .from("relation_reports")
    .update({
      notified_at: new Date().toISOString(),
      notified_by_clerk_id: adminClerkId ?? null,
    })
    .eq("id", reportId);
  if (updateErr) {
    console.error(
      "[/api/admin/reports/[id]/notify-pro] persist notified_at failed",
      updateErr,
    );
  }

  void recordEvent({
    type: "admin.report_pro_notified",
    severity: "info",
    prospectId: report.prospect_id,
    proAccountId: report.pro_account_id,
    relationId: report.relation_id,
    payload: {
      reportId: report.id,
      reason: report.reason,
      proEmail,
      by: adminClerkId ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
