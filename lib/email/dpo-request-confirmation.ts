/**
 * Mail de confirmation envoyé à l'utilisateur après soumission du
 * formulaire RGPD (/contact-dpo). Contient le récapitulatif de sa
 * demande pour qu'il garde une trace écrite. Le DPO reçoit en parallèle
 * la demande "brute" (cf. app/api/contact-dpo/route.ts).
 *
 * Ton chaleureux et rassurant : on confirme la réception et on rappelle
 * le délai légal d'un mois. On précise comment répondre au DPO si besoin.
 *
 * Design identique aux autres mails BUUPP (relation-refused,
 * pro-report-warning) : bandeau header confetti + carte ivoire +
 * footer triangles.
 */

import { getFromAddress, safeSendMail } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const RGPD_URL = `${APP_URL}/rgpd`;

const DPO_REPLY_TO =
  process.env.DPO_INBOX ?? "dp.buupp@buupp.com";

export type DpoRequestConfirmationParams = {
  to: string;
  requestTypeLabel: string;
  subject: string;
  message: string;
};

export async function sendDpoRequestConfirmation(
  params: DpoRequestConfirmationParams,
): Promise<void> {
  const { to, requestTypeLabel, subject, message } = params;
  const mailSubject = "Votre demande RGPD a bien été reçue";

  const text = [
    "Bonjour,",
    "",
    "Nous avons bien reçu votre demande RGPD via le formulaire BUUPP. Vous trouverez ci-dessous le récapitulatif.",
    "",
    `Type de demande : ${requestTypeLabel}`,
    `Objet           : ${subject}`,
    "",
    "Votre message :",
    "------------",
    message,
    "------------",
    "",
    `Notre DPO va traiter votre demande et reviendra vers vous dans un délai d'un mois maximum, conformément au RGPD. Si besoin, vous pouvez répondre directement à ce mail ou écrire à ${DPO_REPLY_TO}.`,
    "",
    `Pour en savoir plus sur notre politique : ${RGPD_URL}`,
    "",
    "Chaleureusement,",
    "L'équipe BUUPP",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(mailSubject)}</title></head>
<body style="margin:0;padding:0;background:#F7F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F1629;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F4EC;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFEF8;border-radius:18px;border:1px solid #EAE3D0;overflow:hidden;box-shadow:0 4px 24px -8px rgba(15,22,41,.08);">
<tr><td style="padding:0;">
  <!-- Bandeau header -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#F1F2F6 0%,#E8EAF1 50%,#DDE0EA 100%);background-color:#E8EAF1;">
    <tr><td style="padding:24px 32px 18px;position:relative;">
      <div style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#4596EC;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:10px;height:10px;background:#7C3AED;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #F59E0B;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;vertical-align:middle;"></div>
      <div style="margin-top:14px;">
        <div style="font-family:Georgia,serif;font-size:30px;font-weight:600;color:#0F1629;letter-spacing:-.01em;">BUUPP</div>
        <div style="font-size:11px;color:#6B7180;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;font-weight:600;">✓ Demande RGPD bien reçue</div>
      </div>
    </td></tr>
    <tr><td style="height:14px;background-image:linear-gradient(135deg,#FFFEF8 25%,transparent 25%,transparent 50%,#FFFEF8 50%,#FFFEF8 75%,transparent 75%);background-size:14px 14px;line-height:0;font-size:0;">&nbsp;</td></tr>
  </table>

<tr><td style="padding:24px 32px 8px;">
  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#0F1629;font-weight:500;">
    Bonjour 👋
  </h1>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3A4150;">
    Nous avons bien reçu votre demande RGPD via le formulaire BUUPP — voici le récapitulatif que vous pouvez conserver pour vos archives.
  </p>

  <!-- Bloc récapitulatif -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;border-collapse:separate;">
    <tr>
      <td style="padding:16px 18px;background:#FAF6E8;border:1px solid #EAE3D0;border-left:4px solid #4596EC;border-radius:14px;">
        <div style="font-size:11px;color:#4596EC;text-transform:uppercase;letter-spacing:.14em;font-weight:600;margin-bottom:10px;">Votre demande</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:13.5px;line-height:1.6;color:#0F1629;">
          <tr>
            <td style="padding:2px 0;color:#6B7180;width:38%;">Type de demande</td>
            <td style="padding:2px 0;font-weight:500;">${escapeHtml(requestTypeLabel)}</td>
          </tr>
          <tr>
            <td style="padding:2px 0;color:#6B7180;">Objet</td>
            <td style="padding:2px 0;font-weight:500;">${escapeHtml(subject)}</td>
          </tr>
        </table>
        <div style="margin-top:12px;padding-top:12px;border-top:1px dashed #EAE3D0;">
          <div style="font-size:11px;color:#6B7180;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Message envoyé</div>
          <div style="font-size:13.5px;line-height:1.55;color:#0F1629;white-space:pre-wrap;font-style:italic;">${escapeHtml(message)}</div>
        </div>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 14px;font-size:14.5px;line-height:1.6;color:#3A4150;">
    Notre DPO va examiner votre demande et reviendra vers vous <strong>dans un délai d'un mois maximum</strong>, conformément au RGPD. Si nécessaire, ce délai peut être prolongé de deux mois — nous vous le ferions savoir.
  </p>
  <p style="margin:0 0 14px;font-size:14.5px;line-height:1.6;color:#3A4150;">
    Une question dans l'intervalle ? <strong>Répondez simplement à ce mail</strong> ou écrivez à <a href="mailto:${escapeHtml(DPO_REPLY_TO)}" style="color:#4596EC;text-decoration:underline;">${escapeHtml(DPO_REPLY_TO)}</a>.
  </p>

  <p style="margin:18px 0 8px;text-align:center;">
    <a href="${RGPD_URL}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:11px 24px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 100%);color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;box-shadow:0 4px 14px -4px rgba(69,150,236,.55);">
      Notre politique RGPD →
    </a>
  </p>

  <p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#6B7180;text-align:center;">
    Merci pour votre confiance.
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
    BUUPP — Be Used, Paid &amp; Proud · Chaleureusement, l'équipe BUUPP.
  </p>
</td></tr>
</td></tr>
</table>
</td></tr></table>
</body></html>
  `.trim();

  await safeSendMail({
    from: getFromAddress(),
    to,
    replyTo: DPO_REPLY_TO,
    subject: mailSubject,
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
