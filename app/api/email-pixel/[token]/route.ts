/**
 * GET /api/email-pixel/[token].png
 *
 * Pixel transparent 1×1 GIF embarqué dans les emails HTML pro→prospect
 * (cf. lib/email/pro-to-prospect). À chaque chargement du pixel, on
 * inscrit `email_opened_at = now()` sur la première ouverture pour le
 * token correspondant.
 *
 * Conformité CNIL (recommandations 2025 pixels email) : le pixel n'est
 * inséré dans le HTML qu'avec un consentement explicite côté prospect
 * (`prospect_identity.email_tracking_consent`). Si la ligne pro_contact
 * _actions ciblée n'existe pas (token invalide ou expurgé), on répond
 * un 200 avec un pixel quand même — on ne distingue jamais
 * succès/échec côté réseau pour éviter de signaler une lecture
 * sélective côté admin.
 *
 * Robustesse : ne lève jamais d'erreur 5xx — sinon les clients mail
 * masquent la ressource et affichent un cadenas brisé, dégradant
 * l'expérience prospect.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// Pixel GIF 1×1 transparent — 43 octets, format universel toléré par
// tous les clients mail (Gmail, Outlook, Apple Mail). Encodé en base64
// pour pouvoir le re-générer sans dépendance fichier.
const PIXEL_BASE64 =
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PIXEL_BUFFER = Buffer.from(PIXEL_BASE64, "base64");

export async function GET(_req: Request, ctx: RouteContext) {
  const { token } = await ctx.params;

  // Validation UUID — on évite de tabasser la DB avec des chaînes
  // arbitraires si le token n'est pas un UUID valide.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    token,
  );
  if (isUuid) {
    void (async () => {
      try {
        const admin = createSupabaseAdminClient();
        // Lecture pour ne pas écraser un email_opened_at déjà set
        // (première ouverture est la plus parlante — les re-ouvertures
        // sont du bruit côté analytics).
        const { data: row } = await admin
          .from("pro_contact_actions")
          .select("id, email_opened_at, kind")
          .eq("tracking_token", token)
          .eq("kind", "email_sent")
          .maybeSingle();
        if (row && !row.email_opened_at) {
          await admin
            .from("pro_contact_actions")
            .update({ email_opened_at: new Date().toISOString() })
            .eq("id", row.id);
        }
      } catch (err) {
        console.error("[/api/email-pixel] log open failed", err);
      }
    })();
  }

  // Réponse pixel toujours servie, quel que soit le résultat DB.
  // Headers anti-cache pour que la même ouverture soit retracée si
  // l'utilisateur ré-ouvre l'email (le filtre côté DB ignorera).
  return new Response(PIXEL_BUFFER, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL_BUFFER.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
    },
  });
}
