/**
 * GET /api/campaign/[id]/preview — « La Vitrine ».
 *
 * Renvoie (via redirection) un APERÇU image de la page d'accueil du site web
 * du pro, pour l'afficher en vignette côté prospect (carré arrondi cliquable)
 * au lieu d'un simple lien texte.
 *
 * - La capture est générée par le service mShots de WordPress.com (gratuit,
 *   sans clé). La 1ʳᵉ requête peut renvoyer un placeholder le temps que la
 *   capture se génère, puis la vraie capture aux chargements suivants.
 * - On ne capture QUE `campaigns.website_url` (URL https validée à la
 *   création) — jamais un paramètre client (pas de SSRF / open-redirect).
 * - L'URL réelle reste côté serveur : le client ne voit que cette route.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: camp } = await admin
    .from("campaigns")
    .select("id, website_url")
    .eq("id", id)
    .single();
  if (!camp || !camp.website_url) {
    return NextResponse.json({ error: "no_website" }, { status: 404 });
  }

  // Largeur d'aperçu adaptable (?w=...) — bornée pour rester raisonnable.
  const wRaw = Number(new URL(req.url).searchParams.get("w"));
  const w = Number.isFinite(wRaw) && wRaw >= 200 && wRaw <= 1280 ? Math.round(wRaw) : 640;

  const shot = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(camp.website_url)}?w=${w}`;
  // 307 : la vignette <img> suit la redirection ; cache court côté navigateur.
  return NextResponse.redirect(shot, {
    status: 307,
    headers: { "cache-control": "public, max-age=3600" },
  });
}
