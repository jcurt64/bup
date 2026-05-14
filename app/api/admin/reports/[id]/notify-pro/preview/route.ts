/**
 * GET /api/admin/reports/[id]/notify-pro/preview
 *
 * Renvoie le contenu exact du mail qui sera envoyé via POST /notify-pro,
 * pour que l'admin puisse le prévisualiser dans une iframe avant de
 * confirmer l'envoi. Aucune action de bord — ni envoi, ni persistance.
 *
 * Réponse : { from, to, subject, html, text, alreadyNotified, notifiedAt }
 */

import { NextResponse } from "next/server";
import { clerkClient } from "@/lib/clerk/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  buildProReportWarningContent,
  type ProReportWarningReason,
} from "@/lib/email/pro-report-warning";
import { getFromAddress } from "@/lib/email/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const { id: reportId } = await ctx.params;
  if (!reportId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: report, error } = await admin
    .from("relation_reports")
    .select(
      `id, reason, notified_at,
       pro_accounts ( id, raison_sociale, clerk_user_id ),
       relations ( id, sent_at, campaigns ( id, name ) )`,
    )
    .eq("id", reportId)
    .maybeSingle();
  if (error) {
    console.error("[/api/admin/reports/[id]/notify-pro/preview] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: "report_not_found" }, { status: 404 });
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
    console.error(
      "[/api/admin/reports/[id]/notify-pro/preview] clerk getUser failed",
      err,
    );
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

  const { subject, text, html } = buildProReportWarningContent({
    proName: proRow?.raison_sociale ?? "—",
    reason: report.reason as ProReportWarningReason,
    campaignName: campaignRow?.name ?? null,
    sentAt: relationRow?.sent_at ?? null,
  });

  return NextResponse.json({
    from: getFromAddress(),
    to: proEmail,
    subject,
    html,
    text,
    alreadyNotified: report.notified_at !== null,
    notifiedAt: report.notified_at ?? null,
  });
}
