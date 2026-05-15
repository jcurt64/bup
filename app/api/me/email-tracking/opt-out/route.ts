/**
 * GET /api/me/email-tracking/opt-out?t=<token>
 *
 * Endpoint d'opposition 1-clic au pixel de tracking dans les broadcasts.
 * Inclus dans chaque broadcast (footer texte + lien HTML). Le destinataire
 * peut cliquer SANS être connecté → on identifie l'utilisateur via une
 * signature HMAC-SHA256 du payload `userId:role` (cf. lib/email-tracking/token.ts).
 *
 * Conformité CNIL n° 2026-042 : "opposition facilement accessible dès la
 * 1re communication". Aucun login requis ; le token est jetable mais
 * stable (un même destinataire = même token, donc relogiable depuis n'importe
 * quel mail reçu).
 *
 * Route PUBLIQUE par construction — pas de session Clerk attendue. Ajoutée
 * à la liste de proxy.ts.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { verifyOptOutToken } from "@/lib/email-tracking/token";

export const runtime = "nodejs";

// Page de confirmation minimaliste — pas de framework, juste un HTML inline
// pour limiter les dépendances et garantir un rendu rapide même côté
// edge/serverless. Cohérent avec le design system BUUPP (ivoire / Fraunces).
//
// Cas "ok" : on inclut un bouton de bascule inverse (réactiver après
// opt-out, désactiver après opt-in) qui réutilise le MÊME token — le
// token signe juste l'identité, pas l'action, donc il fonctionne dans
// les deux sens via le query `?action=opt-in|opt-out`.
function confirmationHtml(
  status: "ok" | "invalid" | "error",
  opts: {
    action?: "opt-out" | "opt-in";
    role?: string;
    /** Token brut tel que reçu — réinjecté dans le lien de bascule inverse. */
    token?: string;
  } = {},
): string {
  const { action = "opt-out", role, token } = opts;
  const isOk = status === "ok";
  const isOptIn = action === "opt-in";
  const title = isOk
    ? isOptIn
      ? "Suivi réactivé"
      : "Opposition enregistrée"
    : status === "invalid"
      ? "Lien invalide"
      : "Une erreur est survenue";
  const message = isOk
    ? isOptIn
      ? `Le suivi des ouvertures de vos broadcasts BUUPP est réactivé. Vos prochains emails inclueront à nouveau le pixel transparent de mesure d'audience. Vous pouvez vous y opposer à nouveau à tout moment.`
      : `Vous n'apparaîtrez plus dans les statistiques d'ouverture des prochains broadcasts BUUPP. Vous pouvez réactiver le suivi à tout moment via le bouton ci-dessous, ou depuis votre espace ${role === "pro" ? "« Mes informations »" : "« Préférences »"}.`
    : status === "invalid"
      ? "Ce lien n'est plus valide ou a été modifié. Recliquez sur le lien depuis un email récent ou écrivez à notre Chargé à la protection des données."
      : "Impossible d'enregistrer votre choix pour le moment. Réessayez dans quelques minutes ou écrivez à notre DPO.";
  const accent = isOk ? "#10B981" : "#DC2626";

  // Bouton de bascule inverse : seulement quand l'action en cours a réussi
  // ET qu'on a un token valide à réinjecter.
  const reverseAction = isOptIn ? "opt-out" : "opt-in";
  const reverseLabel = isOptIn ? "Me désinscrire à nouveau" : "Réactiver le suivi";
  const reverseHref =
    isOk && token
      ? `/api/me/email-tracking/opt-out?t=${encodeURIComponent(token)}&action=${reverseAction}`
      : null;

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title} — BUUPP</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
<style>
  body { margin: 0; padding: 40px 20px; background: #F7F4EC; color: #0F1629; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; min-height: 100vh; box-sizing: border-box; }
  .card { max-width: 540px; margin: 60px auto 0; background: #FFFEF8; border: 1px solid #EAE3D0; border-radius: 16px; padding: 36px 32px; box-shadow: 0 4px 24px -8px rgba(15,22,41,.08); }
  .tag { display: inline-block; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: ${accent}; font-weight: 600; margin-bottom: 18px; }
  h1 { font-family: 'Fraunces', Georgia, serif; font-size: 28px; line-height: 1.2; font-weight: 500; margin: 0 0 14px; letter-spacing: -.01em; }
  p { font-size: 15px; line-height: 1.6; color: #3A4150; margin: 0 0 18px; }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 6px; }
  .cta { display: inline-flex; align-items: center; padding: 11px 22px; text-decoration: none; border-radius: 999px; font-weight: 500; font-size: 14px; transition: background .15s, color .15s, border-color .15s; }
  .cta-primary { background: #0F1629; color: #FFFEF8; }
  .cta-primary:hover { background: #3A4150; }
  .cta-secondary { background: #FFFEF8; color: #0F1629; border: 1px solid #EAE3D0; }
  .cta-secondary:hover { background: #F7F4EC; border-color: #C9D2E0; }
  .meta { margin-top: 28px; padding-top: 18px; border-top: 1px solid #EAE3D0; font-size: 12px; color: #6B7180; }
</style>
</head><body>
<div class="card">
  <div class="tag">${isOk ? "✓ Préférence enregistrée" : "⚠ Échec"}</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <div class="actions">
    <a href="/" class="cta cta-primary">Retour à BUUPP →</a>
    ${reverseHref ? `<a href="${reverseHref}" class="cta cta-secondary">${reverseLabel}</a>` : ""}
  </div>
  <div class="meta">
    Cette page applique votre droit d'opposition au sens de la recommandation
    CNIL n° 2026-042 sur les pixels de suivi dans les courriels.
  </div>
</div>
</body></html>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  // `action` détermine le sens de bascule : "opt-out" (default, depuis
  // l'email) ou "opt-in" (depuis le bouton "Réactiver le suivi" affiché
  // sur la page de confirmation post-opt-out). Le même token sert dans
  // les deux sens — il signe seulement l'identité du destinataire.
  const actionRaw = url.searchParams.get("action");
  const action: "opt-out" | "opt-in" = actionRaw === "opt-in" ? "opt-in" : "opt-out";
  const consent = action === "opt-in";
  const payload = verifyOptOutToken(token);

  if (!payload) {
    return new NextResponse(confirmationHtml("invalid", { action }), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Horodatage d'audit : timestamp quand opt-IN (consentement explicite),
  // null quand opt-OUT. Indispensable pour la bascule CNIL du 15 juillet
  // 2026 — sans ça impossible de distinguer "présumé consentant" de
  // "explicitement consentant" (cf. lib/cnil/bascule.ts).
  const consentGivenAt = consent ? new Date().toISOString() : null;

  const admin = createSupabaseAdminClient();
  try {
    if (payload.role === "prospect") {
      // Récupère prospect_id depuis prospects.clerk_user_id puis update.
      const { data: prospectRow } = await admin
        .from("prospects")
        .select("id")
        .eq("clerk_user_id", payload.userId)
        .maybeSingle();
      if (!prospectRow) throw new Error("prospect_not_found");
      // Upsert : si la row palier 1 n'existe pas (utilisateur qui n'a
      // jamais ouvert "Mes données"), on la crée avec le consent posé.
      await admin
        .from("prospect_identity")
        .upsert(
          {
            prospect_id: prospectRow.id,
            email_tracking_consent: consent,
            email_tracking_consent_given_at: consentGivenAt,
          },
          { onConflict: "prospect_id" },
        );
    } else {
      await admin
        .from("pro_accounts")
        .update({
          email_tracking_consent: consent,
          email_tracking_consent_given_at: consentGivenAt,
        })
        .eq("clerk_user_id", payload.userId);
    }
  } catch (err) {
    console.error("[/api/me/email-tracking/opt-out] update failed", err);
    return new NextResponse(
      confirmationHtml("error", { action, role: payload.role, token: token ?? undefined }),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  return new NextResponse(
    confirmationHtml("ok", { action, role: payload.role, token: token ?? undefined }),
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}
