/** GET /api/studies/unsubscribe?t=<jeton signé> — désabonnement en un clic du récapitulatif e-mail. */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { verifyUnsubscribe } from "@/lib/studies/unsubscribe";

export const runtime = "nodejs";

const page = (msg: string) =>
  new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BUUPP</title></head><body style="font-family:system-ui,sans-serif;background:#F7F4EC;color:#0F172A;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px"><div style="max-width:460px;text-align:center"><h1 style="font-family:Georgia,serif">BUUPP</h1><p>${msg}</p><p><a href="/tests-etudes">Voir les campagnes Tests &amp; Études</a></p></div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );

export async function GET(req: Request) {
  const id = verifyUnsubscribe(new URL(req.url).searchParams.get("t") ?? "");
  if (!id) return page("Lien invalide ou expiré.");
  await createSupabaseAdminClient().from("prospects").update({ studies_email_digest: false }).eq("id", id);
  return page("C'est noté : vous ne recevrez plus le récapitulatif des campagnes Tests &amp; Études. Vous pouvez le réactiver depuis votre espace.");
}
