/**
 * GET /api/me/is-pro — détecte si l'utilisateur courant possède un
 * compte professionnel sur BUUPP (= une row dans `pro_accounts`).
 *
 * Endpoint public (whitelisté dans `proxy.ts`) car il doit pouvoir
 * répondre `{ authenticated: false }` sans exiger d'auth Clerk préalable.
 *
 * Retours :
 *   { authenticated: false }                    — pas connecté
 *   { authenticated: true, isPro: true|false }  — connecté, isPro
 *                                                 selon `pro_accounts`
 *
 * Lecture seule : on n'appelle PAS `ensureProAccount` ici. Sinon le
 * simple fait de cliquer sur un bouton tarifs créerait une row pro
 * pour un prospect — ce qui contredit le but du check.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ authenticated: false });
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("pro_accounts")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[/api/me/is-pro] lookup error", error);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  return NextResponse.json({ authenticated: true, isPro: !!data });
}
