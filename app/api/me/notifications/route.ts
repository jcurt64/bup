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

  // Deux sources de broadcasts visibles à l'utilisateur :
  //  - les broadcasts d'audience large (prospects / pros / all) ET sans
  //    target_clerk_user_id (= broadcasts classiques pour tout le monde)
  //  - les broadcasts ciblés où target_clerk_user_id = userId courant
  //    (ex. message automatique "non joignable" envoyé par le système).
  // Deux queries indépendantes puis merge JS — plus robuste qu'un .or()
  // imbriqué (PostgREST gère mal les virgules dans `audience.in.(…)`
  // quand on les met dans un and(...) imbriqué dans un or(...)).
  const SELECT_COLS =
    "id, title, body, attachment_path, attachment_filename, audience, created_at, target_clerk_user_id";
  const [audienceRes, targetedRes] = await Promise.all([
    admin
      .from("admin_broadcasts")
      .select(SELECT_COLS)
      .is("target_clerk_user_id", null)
      .in("audience", audiences)
      .order("created_at", { ascending: false })
      .limit(LIST_CAP),
    admin
      .from("admin_broadcasts")
      .select(SELECT_COLS)
      .eq("target_clerk_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIST_CAP),
  ]);

  if (audienceRes.error || targetedRes.error) {
    console.error(
      "[/api/me/notifications GET] read failed",
      audienceRes.error ?? targetedRes.error,
    );
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  // Merge + dédup par id (sécurité : un broadcast peut techniquement
  // matcher les deux requêtes si quelqu'un édite manuellement) + tri
  // par created_at desc + cap à LIST_CAP.
  const merged = [...(targetedRes.data ?? []), ...(audienceRes.data ?? [])];
  const seen = new Set<string>();
  const broadcasts = merged
    .filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, LIST_CAP);

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
