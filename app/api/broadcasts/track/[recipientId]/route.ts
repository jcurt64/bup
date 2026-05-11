/**
 * GET /api/broadcasts/track/[recipientId]
 *
 * Pixel de tracking 1×1 invisible inclus dans le HTML des broadcasts admin.
 * Quand un client mail charge l'image (au moment où l'utilisateur ouvre
 * l'email), on enregistre l'ouverture côté `admin_broadcast_recipients` :
 * - `opened_at` posé au premier fetch (puis figé)
 * - `open_count` incrémenté à chaque fetch (multi-devices / re-lectures)
 *
 * Route PUBLIQUE par construction (cf. proxy.ts) : les clients mail ne
 * peuvent pas porter de session Clerk. La sécurité repose sur l'opacité
 * de `recipient_id` (UUID v4) — non énumérable, scopé à un broadcast.
 *
 * Privacy & RGPD/CNIL (cf. politique cookies §"Pixels de tracking email") :
 * - Aucun stockage d'IP, d'user-agent ni de fingerprint
 * - Mesure agrégée d'audience uniquement
 * - Pas de croisement avec d'autres traitements
 * - Réponse cache-busted pour ne pas dépendre du cache navigateur
 *   sans pour autant tenter de re-identifier l'utilisateur
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 1×1 GIF transparent (43 octets) — encodé en base64. C'est le plus petit
// format universellement supporté par les clients mail. PNG/WebP feraient
// l'affaire mais sont légèrement plus gros et moins universels (Outlook
// 2007-2013 sur Windows a un passif compliqué avec PNG).
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

function pixelResponse(): NextResponse {
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF.length),
      // Cache-busting : on veut idéalement compter chaque ouverture (un
      // user qui rouvre 2 fois → 2 fetchs). Les clients mail respectent
      // diversement ces headers, mais on les pose pour les bons élèves.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ recipientId: string }> },
) {
  const { recipientId } = await ctx.params;

  // Validation stricte du format UUID — refuse les tentatives de scan
  // arbitraires sur la table. On répond toujours par le pixel (pas d'info
  // sur la validité ou non du tracking) pour ne rien révéler à un scanner.
  if (!recipientId || !/^[0-9a-f-]{36}$/i.test(recipientId)) {
    return pixelResponse();
  }

  const admin = createSupabaseAdminClient();

  // Lit la row pour décider : si jamais ouverte, on pose `opened_at` ; sinon
  // on incrémente juste `open_count`. Deux requêtes séquentielles plutôt
  // qu'une RPC pour rester simple — la concurrence sur un même recipient
  // est inexistante en pratique (un client mail = une ouverture à la fois).
  const { data: row, error: lookupErr } = await admin
    .from("admin_broadcast_recipients")
    .select("id, opened_at, open_count")
    .eq("id", recipientId)
    .maybeSingle();
  if (lookupErr || !row) {
    // Volontairement silencieux : pas de log à chaque scan, juste retour
    // de pixel. Les erreurs vraies (DB down) sont déjà loggées par
    // Supabase côté serveur.
    return pixelResponse();
  }

  const patch: { open_count: number; opened_at?: string } = {
    open_count: (row.open_count ?? 0) + 1,
  };
  if (!row.opened_at) patch.opened_at = new Date().toISOString();

  const { error: updErr } = await admin
    .from("admin_broadcast_recipients")
    .update(patch)
    .eq("id", recipientId);
  if (updErr) {
    console.error("[/api/broadcasts/track] update failed", updErr);
  }

  return pixelResponse();
}
