/**
 * PATCH /api/pro/campaigns/[id] — toggle status (active ↔ paused).
 *
 * Body : { status: 'active' | 'paused' }
 *
 * Vérifications :
 *  - auth Clerk
 *  - ownership : la campagne appartient au pro courant
 *  - transition autorisée :
 *      active → paused   ✓
 *      paused → active   ✓ si campaigns.ends_at > now()
 *      autres            → 409 invalid_transition
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  let body: { status?: string };
  try { body = (await req.json()) as { status?: string }; }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  if (body.status !== "active" && body.status !== "paused") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const targetStatus = body.status;

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const { data: camp, error: readErr } = await admin
    .from("campaigns")
    .select("id, status, ends_at, pro_account_id")
    .eq("id", id)
    .single();
  if (readErr || !camp) {
    return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
  }
  if (camp.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const valid =
    (camp.status === "active" && targetStatus === "paused") ||
    (camp.status === "paused" && targetStatus === "active");
  if (!valid) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
  }
  if (targetStatus === "active" && camp.ends_at && new Date(camp.ends_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "campaign_expired" }, { status: 410 });
  }

  const { error: updateErr } = await admin
    .from("campaigns")
    .update({ status: targetStatus })
    .eq("id", id)
    .eq("status", camp.status); // TOCTOU guard
  if (updateErr) {
    console.error("[/api/pro/campaigns/PATCH] update failed", updateErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: targetStatus });
}
