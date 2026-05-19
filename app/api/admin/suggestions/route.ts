/**
 * PATCH /api/admin/suggestions — actions de triage sur une suggestion.
 * Auth admin via requireAdminRequest (404 sinon, pas de fuite).
 * Body: { id, action: 'mark-read' | 'resolve' | 'reopen', note? }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminRequest } from "@/lib/admin/access";

export const runtime = "nodejs";

type Body = {
  id?: string;
  action?: "mark-read" | "resolve" | "reopen";
  note?: string | null;
};

export async function PATCH(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const { userId } = await auth();
  const nowIso = new Date().toISOString();

  let update: Record<string, unknown>;
  if (body.action === "mark-read") {
    update = { read_at: nowIso, read_by_clerk_id: userId ?? null };
  } else if (body.action === "resolve") {
    const note = (body.note ?? "").trim().slice(0, 1000) || null;
    update = {
      resolved_at: nowIso,
      resolved_by_clerk_id: userId ?? null,
      resolved_note: note,
      // Résoudre vaut lecture : on renseigne read_* si encore vide.
      read_at: nowIso,
      read_by_clerk_id: userId ?? null,
    };
  } else if (body.action === "reopen") {
    update = {
      resolved_at: null,
      resolved_by_clerk_id: null,
      resolved_note: null,
    };
  } else {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  // `suggestions` absente des types Supabase générés (migration manuelle).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin
    .from("suggestions")
    .update(update)
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
