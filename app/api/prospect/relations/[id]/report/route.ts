/**
 * POST /api/prospect/relations/[id]/report
 * Body : { reason: 'sollicitation_multiple' | 'faux_compte' | 'echange_abusif',
 *          comment?: string }
 *
 * Insère un row dans `relation_reports` après vérification que la
 * relation appartient bien au prospect Clerk-authentifié. La contrainte
 * `unique (relation_id)` empêche tout doublon → renvoyée en 409.
 *
 * Émet un admin_event `prospect.report` (severity warning) côté admin
 * fire-and-forget pour alimenter le LiveFeed + la page Signalements.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import { recordEvent } from "@/lib/admin/events/record";

export const runtime = "nodejs";

const VALID_REASONS = new Set([
  "sollicitation_multiple",
  "faux_compte",
  "echange_abusif",
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: relationId } = await ctx.params;
  if (!relationId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let body: { reason?: string; comment?: string };
  try {
    body = (await req.json()) as { reason?: string; comment?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const reason = body.reason;
  if (!reason || !VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
  }

  const rawComment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (rawComment.length > 1000) {
    return NextResponse.json({ error: "comment_too_long" }, { status: 400 });
  }
  const comment = rawComment.length > 0 ? rawComment : null;

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const prospectId = await ensureProspect({
    clerkUserId: userId,
    email,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });

  const admin = createSupabaseAdminClient();

  // Vérification ownership + récupération de pro_account_id (la clé est
  // recopiée côté serveur — jamais fournie par le client pour éviter
  // l'injection).
  const { data: relation, error: relErr } = await admin
    .from("relations")
    .select("id, prospect_id, pro_account_id")
    .eq("id", relationId)
    .maybeSingle();
  if (relErr) {
    console.error("[/api/prospect/relations/[id]/report] read failed", relErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!relation) {
    return NextResponse.json({ error: "relation_not_found" }, { status: 404 });
  }
  if (relation.prospect_id !== prospectId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insErr } = await (admin as any)
    .from("relation_reports")
    .insert({
      relation_id: relation.id,
      prospect_id: prospectId,
      pro_account_id: relation.pro_account_id,
      reason,
      comment,
    })
    .select("id, created_at")
    .single();

  if (insErr) {
    // Postgres unique violation → 23505
    if ((insErr as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "already_reported" }, { status: 409 });
    }
    console.error("[/api/prospect/relations/[id]/report] insert failed", insErr);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  void recordEvent({
    type: "prospect.report",
    severity: "warning",
    prospectId,
    proAccountId: relation.pro_account_id,
    relationId: relation.id,
    payload: {
      reason,
      hasComment: comment !== null,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ins = inserted as any;
  return NextResponse.json({
    id: ins.id,
    createdAt: ins.created_at,
  });
}
