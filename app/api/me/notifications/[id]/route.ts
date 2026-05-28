/**
 * DELETE /api/me/notifications/[id]
 *
 * Marque le broadcast comme « masqué » pour l'utilisateur courant.
 * Le broadcast lui-même reste intact (il est partagé par audience) ;
 * on insère simplement une row dans admin_broadcast_dismissals qui
 * sert de filtre côté GET /api/me/notifications.
 *
 * Auth Clerk obligatoire. Vérif d'audience symétrique à `/read` —
 * empêche un user de masquer un broadcast hors-audience. Idempotent
 * via ON CONFLICT DO NOTHING. Renvoie 204 No Content.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isGoldFounder } from "@/lib/waitlist/referral";

export const runtime = "nodejs";

export async function DELETE(
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
    .select("id, audience, target_clerk_user_id")
    .eq("id", id)
    .maybeSingle();
  if (bErr) {
    console.error("[/api/me/notifications/[id] DELETE] lookup failed", bErr);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!broadcast) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Vérif d'éligibilité (cf. /read) — un broadcast `prospects` ne peut
  // pas être masqué par un user pro et vice-versa. On accepte aussi les
  // broadcasts ciblés (target_clerk_user_id = userId courant).
  const [{ data: proRow }, { data: prospectRow }] = await Promise.all([
    admin.from("pro_accounts").select("id").eq("clerk_user_id", userId).maybeSingle(),
    admin.from("prospects").select("id").eq("clerk_user_id", userId).maybeSingle(),
  ]);
  const role: "pro" | "prospect" | null = proRow ? "pro" : prospectRow ? "prospect" : null;
  const isTargeted = broadcast.target_clerk_user_id === userId;
  // Cast volontaire : `founders_gold` n'est pas encore dans l'enum DB Supabase
  // (migration manuelle à venir). La valeur est bien stockée et relue en DB.
  const broadcastAudience = broadcast.audience as string;
  let gold = false;
  if (broadcastAudience === "founders_gold" && role === "prospect" && prospectRow) {
    const { data: idRow } = await admin
      .from("prospect_identity")
      .select("email")
      .eq("prospect_id", prospectRow.id)
      .maybeSingle();
    gold = await isGoldFounder(admin, idRow?.email ?? null);
  }
  const eligible =
    isTargeted ||
    broadcastAudience === "all" ||
    (broadcastAudience === "pros" && role === "pro") ||
    (broadcastAudience === "prospects" && role === "prospect") ||
    (broadcastAudience === "founders_gold" && gold);
  if (!eligible) {
    return NextResponse.json({ error: "forbidden_audience" }, { status: 403 });
  }

  // `admin_broadcast_dismissals` n'est pas dans les types Supabase générés
  // (migration manuelle, types non régénérés). Cast volontaire — même
  // esprit que /lib/admin/queries/suggestions.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;
  const { error: insertErr } = await adminAny
    .from("admin_broadcast_dismissals")
    .upsert(
      { broadcast_id: id, clerk_user_id: userId },
      { onConflict: "broadcast_id,clerk_user_id" },
    );
  if (insertErr) {
    console.error("[/api/me/notifications/[id] DELETE] upsert failed", insertErr);
    return NextResponse.json({ error: "dismiss_failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
