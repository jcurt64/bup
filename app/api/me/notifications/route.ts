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
import { isGoldFounder } from "@/lib/waitlist/referral";

export const runtime = "nodejs";

const LIST_CAP = 100;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  // Détection du rôle (mutuellement exclusif depuis 20260508140000).
  // On lit aussi `created_at` pour borner les broadcasts à ceux postés
  // APRÈS l'inscription de l'utilisateur : sinon un nouveau compte
  // hérite de tous les broadcasts historiques (cas signalé en dev quand
  // les comptes pro/prospect créés voyaient les annonces antérieures).
  const [{ data: proRow }, { data: prospectRow }] = await Promise.all([
    admin
      .from("pro_accounts")
      .select("id, created_at")
      .eq("clerk_user_id", userId)
      .maybeSingle(),
    admin
      .from("prospects")
      .select("id, created_at")
      .eq("clerk_user_id", userId)
      .maybeSingle(),
  ]);
  const audiences: ("prospects" | "pros" | "all" | "founders_gold")[] = proRow
    ? ["pros", "all"]
    : prospectRow
      ? ["prospects", "all"]
      : ["all"];
  if (prospectRow && !proRow) {
    const { data: idRow } = await admin
      .from("prospect_identity")
      .select("email")
      .eq("prospect_id", prospectRow.id)
      .maybeSingle();
    if (await isGoldFounder(admin, idRow?.email ?? null)) {
      audiences.push("founders_gold");
    }
  }
  const userSignupAt: string | null =
    proRow?.created_at ?? prospectRow?.created_at ?? null;

  // Deux sources de broadcasts visibles à l'utilisateur :
  //  - les broadcasts d'audience large (prospects / pros / all) ET sans
  //    target_clerk_user_id (= broadcasts classiques pour tout le monde)
  //  - les broadcasts ciblés où target_clerk_user_id = userId courant
  //    (ex. message automatique "non joignable" envoyé par le système).
  //
  // ⚠️ Les deux queries filtrent par audience pour garantir que le rôle
  // est respecté même sur les broadcasts ciblés : un message à audience
  // 'prospects' ne fuit pas vers un user connecté en pro, même si la
  // ligne `prospects.clerk_user_id` collide avec `pro_accounts.clerk_user_id`
  // (cas observé en environnement de dev malgré la migration role
  // exclusivity, et par sécurité défensive de toute façon).
  //
  // Deux queries indépendantes puis merge JS — plus robuste qu'un .or()
  // imbriqué (PostgREST gère mal les virgules dans `audience.in.(…)`
  // quand on les met dans un and(...) imbriqué dans un or(...)).
  const SELECT_COLS =
    "id, title, body, attachment_path, attachment_filename, audience, created_at, target_clerk_user_id";
  // Cutoff : ne renvoyer que les broadcasts émis depuis l'inscription.
  // S'applique aussi aux broadcasts ciblés par sécurité — l'admin ne
  // pourrait techniquement pas viser un user inexistant, mais on borne
  // par cohérence avec la règle générale.
  // Cast volontaire : `founders_gold` n'est pas encore dans l'enum DB Supabase
  // (migration manuelle à venir via SQL Editor). PostgREST accepte la valeur.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audiencesForQuery = audiences as any[];
  const audienceQuery = admin
    .from("admin_broadcasts")
    .select(SELECT_COLS)
    .is("target_clerk_user_id", null)
    .in("audience", audiencesForQuery)
    .order("created_at", { ascending: false })
    .limit(LIST_CAP);
  const targetedQuery = admin
    .from("admin_broadcasts")
    .select(SELECT_COLS)
    .eq("target_clerk_user_id", userId)
    .in("audience", audiencesForQuery)
    .order("created_at", { ascending: false })
    .limit(LIST_CAP);
  if (userSignupAt) {
    audienceQuery.gte("created_at", userSignupAt);
    targetedQuery.gte("created_at", userSignupAt);
  }
  const [audienceRes, targetedRes] = await Promise.all([
    audienceQuery,
    targetedQuery,
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
  const dismissedSet = new Set<string>();
  if (ids.length > 0) {
    const [readsRes, dismissalsRes] = await Promise.all([
      admin
        .from("admin_broadcast_reads")
        .select("broadcast_id")
        .eq("clerk_user_id", userId)
        .in("broadcast_id", ids),
      // `admin_broadcast_dismissals` n'est pas dans les types Supabase
      // générés (migration manuelle). Cast `as any` volontaire, même esprit
      // que ailleurs (lib/admin/queries/suggestions.ts).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any)
        .from("admin_broadcast_dismissals")
        .select("broadcast_id")
        .eq("clerk_user_id", userId)
        .in("broadcast_id", ids),
    ]);
    if (readsRes.error) {
      console.error("[/api/me/notifications GET] reads lookup failed", readsRes.error);
    } else {
      for (const r of readsRes.data ?? []) readSet.add(r.broadcast_id);
    }
    if (dismissalsRes.error) {
      console.error(
        "[/api/me/notifications GET] dismissals lookup failed",
        dismissalsRes.error,
      );
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (dismissalsRes.data ?? []) as { broadcast_id: string }[]) {
        dismissedSet.add(r.broadcast_id);
      }
    }
  }

  // Filtre : les broadcasts que l'utilisateur a explicitement supprimés
  // sont retirés de la liste. Le broadcast reste en DB mais devient
  // invisible pour cet utilisateur (per-user dismissal).
  const items = (broadcasts ?? [])
    .filter((b) => !dismissedSet.has(b.id))
    .map((b) => ({
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
