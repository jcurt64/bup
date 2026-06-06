/**
 * POST /api/admin/founder-bonus/distribute — verse le bonus fondateur 5 €
 * aux prospects éligibles (is_founder, non encore crédités).
 *
 *   ?confirm=1 → distribution RÉELLE (crédits + broadcasts ciblés + emails).
 *   sinon       → dry-run : renvoie seulement { eligible } sans rien écrire.
 *
 * Garde : admin (session Clerk allowlistée OU x-admin-secret), via
 * requireAdminRequest. Idempotent : re-jouer ne double-crédite personne.
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { distributeFounderBonus } from "@/lib/founder-bonus/distribute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const confirm = new URL(req.url).searchParams.get("confirm") === "1";
  const admin = createSupabaseAdminClient();
  const result = await distributeFounderBonus(admin, { confirm });

  return NextResponse.json({ dryRun: !confirm, ...result });
}
