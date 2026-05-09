/**
 * GET /api/me/role — détecte le rôle de l'utilisateur connecté.
 *
 * Endpoint public (whitelisté dans `proxy.ts` via `/api/me/(.*)`) : il
 * répond `{ authenticated: false }` quand personne n'est connecté, sans
 * exiger d'auth Clerk préalable. Permet à la home de pré-vérifier le
 * rôle avant de naviguer vers /prospect ou /pro et d'éviter le détour
 * "redirect → /?role_conflict=...".
 *
 * Lecture seule : aucun appel à `ensureRole` ici. La source de vérité
 * est la DB Supabase (existence d'une row `prospects` ou `pro_accounts`).
 *
 * Retours :
 *   { authenticated: false }
 *   { authenticated: true, role: "prospect" | "pro" | null }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { authenticated: false },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const admin = createSupabaseAdminClient();
  const [{ data: proRow, error: proErr }, { data: prospectRow, error: prospectErr }] =
    await Promise.all([
      admin.from("pro_accounts").select("id").eq("clerk_user_id", userId).maybeSingle(),
      admin.from("prospects").select("id").eq("clerk_user_id", userId).maybeSingle(),
    ]);

  if (proErr || prospectErr) {
    console.error("[/api/me/role] lookup error", proErr || prospectErr);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  const role: "prospect" | "pro" | null = proRow
    ? "pro"
    : prospectRow
      ? "prospect"
      : null;

  return NextResponse.json(
    { authenticated: true, role },
    { headers: { "cache-control": "no-store" } },
  );
}
