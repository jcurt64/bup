/**
 * Mail envoyé par un pro à un prospect via l'interface "Actions intégrées"
 * de BUUPP (onglet Contacts du dashboard pro). Le pro tape son message
 * directement dans BUUPP — l'envoi part de notre transport SMTP, avec
 *   From    : BUUPP (jamais l'adresse personnelle du pro)
 *   Reply-To: l'email du pro (les réponses lui arrivent directement)
 *
 * Ce design répond à la promesse "le pro n'a pas besoin de copier les
 * coordonnées du prospect" et garantit côté plateforme que :
 *  - chaque envoi est tracé en base (pro_contact_actions),
 *  - le prospect peut répondre normalement (Reply-To),
 *  - l'identité visuelle BUUPP reste reconnaissable dans la boîte du prospect.
 *
 * Quota : limité côté API (1 email max par couple pro × prospect × campagne).
 */

import { getFromAddress, safeSendMail } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const PROSPECT_URL = `${APP_URL}/prospect`;

export type ProToProspectParams = {
  /** Email du prospect (destinataire). */
  to: string;
  /** Email du pro — utilisé en Reply-To pour que le prospect réponde. */
  proReplyTo: string;
  /** Raison sociale du pro affichée dans le mail. */
  proName: string;
  /** Prénom du prospect pour la salutation. */
  prospectFirstName: string | null;
  /** Nom de la campagne au titre de laquelle le pro a obtenu le contact. */
  campaignName: string;
  /** Objet du mail (saisi par le pro). */
  subject: string;
  /** Corps du mail (saisi par le pro). */
  body: string;
  /**
   * Token UUID d'ouverture. Si fourni ET que `trackingConsent` est true,
   * un pixel 1×1 référençant `/api/email-pixel/[token]` est inséré dans
   * le HTML. Sinon, aucun pixel — conformité CNIL stricte.
   */
  trackingToken?: string | null;
  /**
   * Consentement explicite du prospect au tracking des ouvertures
   * (champ `prospect_identity.email_tracking_consent`). Si false, le
   * pixel N'EST PAS inséré même si le token est fourni.
   */
  trackingConsent?: boolean;
};

export async function sendProToProspectEmail(
  params: ProToProspectParams,
): Promise<void> {
  const { to, proReplyTo, proName, prospectFirstName, campaignName, subject, body, trackingToken, trackingConsent } =
    params;
  const greet = prospectFirstName?.trim() || "Bonjour";
  // Pixel uniquement si consentement explicite — conformité CNIL.
  const pixelHtml = trackingConsent && trackingToken
    ? `<img src="${APP_URL}/api/email-pixel/${encodeURIComponent(trackingToken)}" alt="" width="1" height="1" border="0" style="display:block;width:1px;height:1px;border:0;line-height:0;font-size:0;"/>`
    : "";

  const text = [
    `Bonjour ${greet},`,
    "",
    `Ce message vous est adressé par ${proName} via BUUPP suite à votre acceptation de la campagne « ${campaignName} ».`,
    "",
    "—",
    body,
    "—",
    "",
    `Pour répondre, utilisez simplement la fonction "Répondre" de votre messagerie — ${proName} recevra directement votre message.`,
    "",
    `Votre espace BUUPP : ${PROSPECT_URL}`,
    "",
    "À bientôt,",
    "L'équipe BUUPP",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F7F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F1629;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F4EC;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFEF8;border-radius:18px;border:1px solid #EAE3D0;overflow:hidden;box-shadow:0 4px 24px -8px rgba(15,22,41,.08);">
<tr><td style="padding:0;">
  <!-- Bandeau header BUUPP -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#F1F2F6 0%,#E8EAF1 50%,#DDE0EA 100%);background-color:#E8EAF1;">
    <tr><td style="padding:24px 32px 18px;">
      <div style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#4596EC;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:10px;height:10px;background:#7C3AED;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #F59E0B;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;vertical-align:middle;"></div>
      <div style="margin-top:14px;">
        <div style="font-family:Georgia,serif;font-size:30px;font-weight:600;color:#0F1629;letter-spacing:-.01em;">BUUPP</div>
        <div style="font-size:11px;color:#6B7180;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;font-weight:600;">✉ Message de ${escapeHtml(proName)}</div>
      </div>
    </td></tr>
    <tr><td style="height:14px;background-image:linear-gradient(135deg,#FFFEF8 25%,transparent 25%,transparent 50%,#FFFEF8 50%,#FFFEF8 75%,transparent 75%);background-size:14px 14px;line-height:0;font-size:0;">&nbsp;</td></tr>
  </table>

<tr><td style="padding:24px 32px 8px;">
  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:#0F1629;font-weight:500;">
    Bonjour ${escapeHtml(greet)} 👋
  </h1>

  <p style="margin:0 0 16px;font-size:14.5px;line-height:1.6;color:#3A4150;">
    Ce message vous est adressé par <strong>${escapeHtml(proName)}</strong> via BUUPP, suite à votre acceptation de la campagne <em>${escapeHtml(campaignName)}</em>.
  </p>

  <!-- Bloc message du pro -->
  <div style="padding:18px 20px;background:#FAF6E8;border:1px solid #EAE3D0;border-left:4px solid #4596EC;border-radius:14px;margin-bottom:18px;">
    <div style="font-size:11px;color:#4596EC;text-transform:uppercase;letter-spacing:.14em;font-weight:600;margin-bottom:10px;">
      Message
    </div>
    <div style="font-size:14.5px;line-height:1.7;color:#0F1629;white-space:pre-wrap;">${escapeHtml(body)}</div>
  </div>

  <p style="margin:0 0 14px;font-size:13.5px;line-height:1.6;color:#3A4150;">
    Pour répondre, utilisez simplement la fonction <strong>« Répondre »</strong> de votre messagerie — ${escapeHtml(proName)} recevra directement votre réponse.
  </p>

  <p style="margin:18px 0 6px;text-align:center;">
    <a href="${PROSPECT_URL}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:11px 24px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 100%);color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;box-shadow:0 4px 14px -4px rgba(69,150,236,.55);">
      Mon espace BUUPP →
    </a>
  </p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px 22px;background:#F7F4EC;border-top:1px solid #EAE3D0;text-align:center;">
  <div style="margin-bottom:12px;font-size:0;line-height:0;">
    <span style="display:inline-block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid #4596EC;margin:0 4px;"></span>
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#7C3AED;margin:0 4px;vertical-align:top;"></span>
    <span style="display:inline-block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid #F59E0B;margin:0 4px;"></span>
    <span style="display:inline-block;width:8px;height:8px;background:#10B981;transform:rotate(45deg);margin:0 4px;vertical-align:top;"></span>
    <span style="display:inline-block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid #6D5BFF;margin:0 4px;"></span>
  </div>
  <a href="${APP_URL}" target="_blank" rel="noopener noreferrer">
    <img src="${LOGO_URL}" alt="BUUPP" width="100" style="display:inline-block;border:0;height:auto;max-width:100px;"/>
  </a>
  <p style="margin:10px 0 0;font-size:11px;color:#6B7180;line-height:1.5;">
    BUUPP — Be Used, Paid &amp; Proud · Données minimisées, consentement respecté.
  </p>
</td></tr>
</td></tr>
</table>
</td></tr></table>
${pixelHtml}
</body></html>
  `.trim();

  await safeSendMail({
    from: getFromAddress(),
    to,
    replyTo: proReplyTo,
    subject,
    text,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
