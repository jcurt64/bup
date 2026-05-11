/**
 * GET /api/me/notifications/[id]/attachment
 *
 * Vérifie l'éligibilité d'audience puis génère une signed URL Supabase
 * Storage (TTL 5 min) et redirige 302 vers cette URL. Le bucket est privé :
 * pas d'accès direct possible sans passer par cet endpoint.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SEC = 300; // 5 min

export async function GET(
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
    .select("id, audience, attachment_path, attachment_filename")
    .eq("id", id)
    .maybeSingle();
  if (bErr) {
    console.error("[/api/me/notifications/[id]/attachment] lookup failed", bErr);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!broadcast || !broadcast.attachment_path) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

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

  const { data: signed, error: signErr } = await admin.storage
    .from("admin-broadcasts")
    .createSignedUrl(broadcast.attachment_path, SIGNED_URL_TTL_SEC, {
      download: broadcast.attachment_filename ?? true,
    });
  if (signErr || !signed?.signedUrl) {
    console.error("[/api/me/notifications/[id]/attachment] sign failed", signErr);
    return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
