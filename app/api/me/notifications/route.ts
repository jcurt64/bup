/**
 * /api/me/notifications — liste des broadcasts admin visibles à l'utilisateur
 * courant, enrichis du flag `unread` (lu = présent dans admin_broadcast_reads).
 *
 * Auth Clerk obligatoire. Le rôle utilisateur (prospect / pro) est dérivé
 * depuis la DB (cf. logique /api/me) pour décider de l'audience visible :
 *  - rôle "prospect" → broadcasts `audience IN ('prospects', 'all')`
 *  - rôle "pro"      → broadcasts `audience IN ('pros', 'all')`
 *  - rôle null       → audience `'all'` uniquement (cas marginal d'un
 *                       Clerk user sans row métier)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const LIST_CAP = 100;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  // Détection du rôle (mutuellement exclusif depuis 20260508140000).
  const [{ data: proRow }, { data: prospectRow }] = await Promise.all([
    admin.from("pro_accounts").select("id").eq("clerk_user_id", userId).maybeSingle(),
    admin.from("prospects").select("id").eq("clerk_user_id", userId).maybeSingle(),
  ]);
  const audiences: ("prospects" | "pros" | "all")[] = proRow
    ? ["pros", "all"]
    : prospectRow
      ? ["prospects", "all"]
      : ["all"];

  const { data: broadcasts, error } = await admin
    .from("admin_broadcasts")
    .select("id, title, body, attachment_path, attachment_filename, audience, created_at")
    .in("audience", audiences)
    .order("created_at", { ascending: false })
    .limit(LIST_CAP);
  if (error) {
    console.error("[/api/me/notifications GET] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const ids = (broadcasts ?? []).map((b) => b.id);
  const readSet = new Set<string>();
  if (ids.length > 0) {
    const { data: reads, error: readErr } = await admin
      .from("admin_broadcast_reads")
      .select("broadcast_id")
      .eq("clerk_user_id", userId)
      .in("broadcast_id", ids);
    if (readErr) {
      console.error("[/api/me/notifications GET] reads lookup failed", readErr);
    } else {
      for (const r of reads ?? []) readSet.add(r.broadcast_id);
    }
  }

  const items = (broadcasts ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    body: b.body,
    audience: b.audience,
    hasAttachment: !!b.attachment_path,
    attachmentFilename: b.attachment_filename,
    createdAt: b.created_at,
    unread: !readSet.has(b.id),
  }));

  return NextResponse.json({
    notifications: items,
    unreadCount: items.filter((i) => i.unread).length,
  });
}
