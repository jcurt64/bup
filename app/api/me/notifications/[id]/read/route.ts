/**
 * POST /api/me/notifications/[id]/read
 *
 * Marque un broadcast comme lu pour l'utilisateur courant. Vérifie d'abord
 * que le broadcast existe ET que son audience couvre le rôle de
 * l'utilisateur (anti-abuse : empêche de marquer un broadcast hors-audience).
 *
 * Idempotent : ON CONFLICT DO NOTHING via upsert. Renvoie 204 No Content.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: broadcast, error: bErr } = await admin
    .from("admin_broadcasts")
    .select("id, audience")
    .eq("id", id)
    .maybeSingle();
  if (bErr) {
    console.error("[/api/me/notifications/[id]/read POST] lookup failed", bErr);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!broadcast) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Vérif d'éligibilité d'audience pour empêcher un user pro de marquer
  // un broadcast prospect (et vice-versa). Cas marginal mais peu coûteux.
  const [{ data: proRow }, { data: prospectRow }] = await Promise.all([
    admin.from("pro_accounts").select("id").eq("clerk_user_id", userId).maybeSingle(),
    admin.from("prospects").select("id").eq("clerk_user_id", userId).maybeSingle(),
  ]);
  const role: "pro" | "prospect" | null = proRow ? "pro" : prospectRow ? "prospect" : null;
  const eligible =
    broadcast.audience === "all" ||
    (broadcast.audience === "pros" && role === "pro") ||
    (broadcast.audience === "prospects" && role === "prospect");
  if (!eligible) {
    return NextResponse.json({ error: "forbidden_audience" }, { status: 403 });
  }

  const { error: insertErr } = await admin
    .from("admin_broadcast_reads")
    .upsert(
      { broadcast_id: id, clerk_user_id: userId },
      { onConflict: "broadcast_id,clerk_user_id" },
    );
  if (insertErr) {
    console.error("[/api/me/notifications/[id]/read POST] upsert failed", insertErr);
    return NextResponse.json({ error: "mark_failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
