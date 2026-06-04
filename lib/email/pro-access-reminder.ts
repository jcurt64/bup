/**
 * Mail de rappel envoyé au PROFESSIONNEL quand il a consulté à plusieurs
 * reprises (≥ 3 ouvertures du détail en 24 h) les informations d'un même
 * contact acquis via BUUPP.
 *
 * Ton volontairement bienveillant, poli et non accusatoire — ce n'est PAS
 * un avertissement : on remercie le pro de sa confiance et on rappelle
 * gentiment le cadre BUUPP sur l'usage des données personnelles des
 * prospects (RGPD, usage limité à la mise en relation, traçabilité).
 *
 * Fire-and-forget : appelé depuis le helper anti-accès-répétés
 * (lib/pro/reveal-alert.ts), jamais bloquant pour l'ouverture du détail.
 * Déduplication (1 mail / couple pro×prospect / 24 h) gérée en amont.
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const PRO_URL = `${APP_URL}/pro`;
const CGV_URL = `${APP_URL}/cgv`;

export type ProAccessReminderParams = {
  /** E-mail du pro (issu de Clerk, transmis par la route). */
  email: string;
  /** Raison sociale du pro (pour personnaliser, optionnel). */
  raisonSociale: string | null;
  /** Prénom du contact concerné (optionnel — le pro y a déjà accès). */
  contactPrenom: string | null;
  /** Nombre d'ouvertures du détail sur 24 h (pour information). */
  accessCount: number;
};

/** @returns true si le mail a bien été remis au transport (sinon false). */
export async function sendProAccessReminder(
  params: ProAccessReminderParams,
): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email/pro-access-reminder] transport indisponible (ni Brevo ni SMTP)");
    return false;
  }

  const { email, raisonSociale, contactPrenom } = params;
  const raison = (raisonSociale ?? "").trim();
  const proGreet = !raison || raison.includes("@") ? "Bonjour" : `Bonjour ${raison}`;
  const contactLabel = contactPrenom?.trim()
    ? `un même contact (${contactPrenom.trim()})`
    : "un même contact acquis via BUUPP";
  const subject = "BUUPP — petit rappel sur l'usage des données de vos contacts";

  const text = [
    `${proGreet},`,
    "",
    `Nous avons remarqué que vous avez cherché à contacter à plusieurs reprises, ces dernières 24 heures, ${contactLabel}.`,
    "",
    "C'est tout à fait normal d'avoir besoin de revenir sur les coordonnées d'un contact — nous profitons simplement de l'occasion pour vous rappeler, en toute confiance, le cadre BUUPP sur l'usage des données personnelles des prospects :",
    "",
    "• Usage strictement limité à la mise en relation acceptée — pas de prospection hors de ce cadre.",
    "• Aucune réutilisation, revente ou transfert des données à des tiers (RGPD).",
    "• Une seule sollicitation par prospect dans le cadre du service BUUPP.",
    "• Chaque consultation est tracée et horodatée.",
    "• Les droits du prospect (accès, rectification, effacement, opposition) doivent être respectés.",
    "",
    "Accéder à mon espace pro :",
    PRO_URL,
    "",
    `Nos conditions générales : ${CGV_URL}`,
    "",
    "Merci de contribuer à un écosystème de confiance — c'est ce qui fait la valeur de BUUPP pour tout le monde.",
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
  <!-- Header doux -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#EAF1FB 0%,#E4ECFA 60%,#DCE7F8 100%);background-color:#EAF1FB;">
    <tr><td style="padding:26px 32px 20px;">
      <div style="font-family:Georgia,serif;font-size:30px;font-weight:600;color:#0F1629;letter-spacing:-.01em;">BUUPP</div>
      <div style="font-size:11px;color:#2563EB;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;font-weight:600;">🛡️ Bon usage des données</div>
    </td></tr>
  </table>

<tr><td style="padding:26px 32px 8px;">
  <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;line-height:1.3;color:#0F1629;font-weight:500;">
    ${escapeHtml(proGreet)},
  </h1>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#3A4150;">
    Nous avons remarqué que vous avez cherché à contacter à plusieurs reprises,
    ces dernières 24&nbsp;heures, ${escapeHtml(contactLabel)}.
  </p>
  <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#3A4150;">
    C'est tout à fait normal d'avoir besoin de revenir sur les coordonnées d'un
    contact — nous profitons simplement de l'occasion pour vous rappeler, en
    toute confiance, le cadre BUUPP sur l'usage des données personnelles des
    prospects.
  </p>

  <!-- Rappel du cadre -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border-collapse:separate;">
    <tr>
      <td style="padding:16px 18px;background:#FAF6E8;border:1px solid #EAE3D0;border-left:4px solid #2563EB;border-radius:12px;">
        <div style="font-size:11px;color:#1D4ED8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px;font-weight:600;">◆ Le cadre BUUPP sur les données prospect</div>
        <div style="font-size:14px;line-height:1.7;color:#0F1629;">
          • <strong>Usage limité à la mise en relation acceptée</strong> — pas de prospection hors de ce cadre.<br/>
          • <strong>Aucune réutilisation, revente ou transfert</strong> des données à des tiers (RGPD).<br/>
          • <strong>Une seule sollicitation par prospect</strong> dans le cadre du service.<br/>
          • <strong>Chaque consultation est tracée</strong> et horodatée.<br/>
          • <strong>Les droits du prospect</strong> (accès, rectification, effacement, opposition) doivent être respectés.
        </div>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 16px;text-align:center;">
    <a href="${PRO_URL}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:14px 32px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 100%);color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;box-shadow:0 4px 14px -4px rgba(69,150,236,.55);">
      Accéder à mon espace pro →
    </a>
  </p>
  <p style="margin:0 0 6px;font-size:13px;color:#6B7180;text-align:center;line-height:1.6;">
    Merci de contribuer à un écosystème de confiance — c'est ce qui fait la
    valeur de BUUPP pour tout le monde. Consultez nos
    <a href="${CGV_URL}" target="_blank" rel="noopener noreferrer" style="color:#4596EC;text-decoration:underline;">conditions générales</a>.
  </p>
</td></tr>

<tr><td style="padding:20px 32px 22px;background:#F7F4EC;border-top:1px solid #EAE3D0;text-align:center;">
  <a href="${APP_URL}" target="_blank" rel="noopener noreferrer">
    <img src="${LOGO_URL}" alt="BUUPP" width="100" style="display:inline-block;border:0;height:auto;max-width:100px;"/>
  </a>
  <p style="margin:10px 0 0;font-size:11px;color:#6B7180;line-height:1.5;">
    BUUPP — Be Used, Paid &amp; Proud · Vos données vous appartiennent.
  </p>
</td></tr>
</td></tr>
</table>
</td></tr></table>
</body></html>
  `.trim();

  try {
    const info = await transport.sendMail({
      from: getFromAddress(),
      to: email,
      subject,
      text,
      html,
    });
    console.log(
      `[email/pro-access-reminder] mail envoyé à ${email} — messageId=${info.messageId}`,
    );
    return true;
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[email/pro-access-reminder] échec d'envoi à ${email} → ${msg}`);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
