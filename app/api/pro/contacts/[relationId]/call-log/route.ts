/**
 * POST /api/pro/contacts/[relationId]/call-log
 *
 * Enregistre un événement "le pro a cliqué pour appeler ce prospect"
 * dans pro_contact_actions. Ne valide rien d'autre que l'ownership de
 * la relation — on ne sait pas si l'appel a abouti, on enregistre
 * uniquement le déclencheur d'intention. C'est utilisé pour l'audit
 * BUUPP et n'a pas d'impact sur les quotas (pas de limite call-side).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ relationId: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { relationId } = await ctx.params;
  if (!relationId) {
    return NextResponse.json({ error: "missing_relation_id" }, { status: 400 });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(relationId)) {
    return NextResponse.json({ error: "invalid_relation_id" }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();

  // Ownership + récupération des FK (pro_account_id, prospect_id,
  // campaign_id) à recopier dans l'event. Le pro doit avoir une
  // relation accepted/settled sur ce relationId.
  const { data: rel, error: readErr } = await admin
    .from("relations")
    .select("id, pro_account_id, prospect_id, campaign_id, status")
    .eq("id", relationId)
    .maybeSingle();
  if (readErr) {
    console.error("[/api/pro/contacts/[id]/call-log] read failed", readErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!rel) {
    return NextResponse.json({ error: "relation_not_found" }, { status: 404 });
  }
  if (rel.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (rel.status !== "accepted" && rel.status !== "settled") {
    return NextResponse.json({ error: "relation_not_accepted" }, { status: 409 });
  }

  const { error: insErr } = await admin.from("pro_contact_actions").insert({
    pro_account_id: proId,
    relation_id: rel.id,
    prospect_id: rel.prospect_id,
    campaign_id: rel.campaign_id,
    kind: "call_clicked",
  });
  if (insErr) {
    console.error("[/api/pro/contacts/[id]/call-log] insert failed", insErr);
    return NextResponse.json({ error: "audit_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
