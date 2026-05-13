/**
 * POST /api/admin/reports/[id]/resolve
 * Body : { action: 'resolve' | 'reopen', note?: string }
 *
 * Garde admin (Clerk allowlist OU x-admin-secret).
 *
 * Met à jour les colonnes resolved_* sur le signalement :
 *  - resolve : set resolved_at=now(), resolved_by_clerk_id=adminId,
 *              resolved_note=note ?? null
 *  - reopen  : reset les 3 colonnes à null
 *
 * Émet un admin_event 'admin.report_resolved' ou 'admin.report_reopened'
 * (info, fire-and-forget).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { recordEvent } from "@/lib/admin/events/record";

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

  let body: { action?: string; note?: string };
  try {
    body = (await req.json()) as { action?: string; note?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "resolve" && action !== "reopen") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  const rawNote = typeof body.note === "string" ? body.note.trim() : "";
  if (rawNote.length > 1000) {
    return NextResponse.json({ error: "note_too_long" }, { status: 400 });
  }
  const note = rawNote.length > 0 ? rawNote : null;

  const admin = createSupabaseAdminClient();
  const patch =
    action === "resolve"
      ? {
          resolved_at: new Date().toISOString(),
          resolved_by_clerk_id: adminClerkId ?? null,
          resolved_note: note,
        }
      : {
          resolved_at: null,
          resolved_by_clerk_id: null,
          resolved_note: null,
        };

  const { data, error } = await admin
    .from("relation_reports")
    .update(patch)
    .eq("id", reportId)
    .select("id, prospect_id, pro_account_id, relation_id")
    .maybeSingle();
  if (error) {
    console.error("[/api/admin/reports/[id]/resolve] update failed", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "report_not_found" }, { status: 404 });
  }

  void recordEvent({
    type: action === "resolve" ? "admin.report_resolved" : "admin.report_reopened",
    severity: "info",
    prospectId: data.prospect_id,
    proAccountId: data.pro_account_id,
    relationId: data.relation_id,
    payload: { reportId: data.id, by: adminClerkId ?? null },
  });

  return NextResponse.json({ ok: true });
}
