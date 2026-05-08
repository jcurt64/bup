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
  // Stats waitlist + date de lancement (depuis app_config). On fait les
  // deux lectures en parallèle. La date de lancement reste tolérante :
  // si la table n'existe pas encore (migrations pas appliquées), on
  // renvoie `launchAt: null` plutôt que de planter l'endpoint public.
  const [statsRes, configRes] = await Promise.all([
    supabase.rpc("waitlist_stats").single(),
    supabase
      .from("app_config")
      .select("launch_at")
      .eq("id", true)
      .maybeSingle(),
  ]);

  if (statsRes.error) {
    console.error("[/api/waitlist/stats] RPC error:", statsRes.error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json(
    {
      total: Number(statsRes.data?.total ?? 0),
      villes: Number(statsRes.data?.villes ?? 0),
      launchAt: configRes.data?.launch_at ?? null,
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
