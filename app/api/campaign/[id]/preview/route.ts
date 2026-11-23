/**
 * GET /api/campaign/[id]/preview — « La Vitrine ».
 *
 * Renvoie l'APERÇU image (capture mShots) de la page d'accueil du site web
 * du pro, affiché en vignette côté prospect.
 *
 * - Proxy serveur (cf. lib/campaigns/site-preview) : seule une vraie capture
 *   est servie (cache 1 jour). Tant qu'elle se génère, 503 NON mis en cache
 *   (Retry-After) → la vignette réessaie au lieu d'afficher l'image d'attente
 *   WordPress.
 * - On ne capture QUE `campaigns.website_url` (URL https validée à la
 *   création) — jamais un paramètre client (pas de SSRF / open-redirect).
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { fetchSitePreview } from "@/lib/campaigns/site-preview";

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

  const shot = await fetchSitePreview(camp.website_url, w);
  if (!shot.ok) {
    return NextResponse.json(
      { error: shot.reason === "pending" ? "preview_pending" : "preview_failed" },
      {
        status: shot.reason === "pending" ? 503 : 502,
        headers: { "cache-control": "no-store", "retry-after": "5" },
      },
    );
  }
  return new NextResponse(shot.body, {
    status: 200,
    headers: {
      "content-type": shot.contentType,
      "cache-control": "public, max-age=86400",
    },
  });
}
