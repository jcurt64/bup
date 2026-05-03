/**
 * GET /api/waitlist/stats — compteurs publics de la liste d'attente.
 *
 * Pas d'auth. Délègue à la RPC `waitlist_stats()` qui agrège sans exposer
 * la moindre donnée personnelle (count + count distinct ville).
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
// Toujours frais — sinon Next.js mémoïse côté serveur et le compteur ne bouge plus.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("waitlist_stats").single();

  if (error) {
    console.error("[/api/waitlist/stats] RPC error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json(
    { total: Number(data?.total ?? 0), villes: Number(data?.villes ?? 0) },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
