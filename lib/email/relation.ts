/**
 * Mail envoyé au prospect quand un pro lance une campagne ciblant son profil.
 * Fire-and-forget : appelé depuis `POST /api/pro/campaigns` en
 * `Promise.allSettled` non-await — un échec SMTP ne fait jamais échouer
 * la création de campagne.
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const LINK_URL = `${APP_URL}/prospect?tab=relations`;

export type RelationInvitationParams = {
  email: string;
  prenom: string | null;
  proName: string;
  proSector: string | null;
  motif: string;
  brief: string | null;
  rewardEur: number;
  expiresAt: string; // ISO
};

export async function sendRelationInvitation(
  params: RelationInvitationParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const {
    email,
    prenom,
    proName,
    proSector,
    motif,
    brief,
    rewardEur,
    expiresAt,
  } = params;

  const greet = prenom?.trim() || "Bonjour";
  const rewardStr = rewardEur.toFixed(2).replace(".", ",");
  const expiresStr = formatDeadline(expiresAt);

  const subject = `Nouvelle mise en relation — ${rewardStr} € à la clé`;

  const text = [
    `Bonjour ${greet},`,
    "",
    `${proName}${proSector ? " (" + proSector + ")" : ""} souhaite vous solliciter sur BUUPP.`,
    "",
    `Objet : ${motif}`,
    brief ? `Le mot du pro : « ${brief} »` : null,
    "",
    `Récompense si vous acceptez : ${rewardStr} €`,
    `Délai pour répondre : ${expiresStr}`,
    "",
    "Vous pouvez accepter ou refuser depuis votre espace prospect :",
    LINK_URL,
    "",
    "À bientôt,",
    "L'équipe BUUPP",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F7F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F1629;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F4EC;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFEF8;border-radius:16px;border:1px solid #EAE3D0;overflow:hidden;">
<tr><td style="padding:28px 32px 12px;border-bottom:1px solid #F1ECDB;">
  <div style="font-family:Georgia,serif;font-size:28px;font-weight:600;color:#0F1629;">BUUPP</div>
  <div style="font-size:12px;color:#6B7180;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">Nouvelle mise en relation</div>
</td></tr>
<tr><td style="padding:28px 32px 8px;">
  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;line-height:1.3;color:#0F1629;font-weight:500;">
    ${escapeHtml(greet)}, un pro vous propose ${rewardStr} €
  </h1>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3A4150;">
    <strong>${escapeHtml(proName)}</strong>${proSector ? ' <span style="color:#6B7180">— ' + escapeHtml(proSector) + "</span>" : ""} souhaite vous solliciter via BUUPP.
  </p>
  <p style="margin:0 0 4px;font-size:14px;color:#6B7180;letter-spacing:.04em;">Objet de la demande</p>
  <p style="margin:0 0 18px;font-size:14.5px;line-height:1.55;color:#0F1629;">${escapeHtml(motif)}</p>
  ${
    brief
      ? `
  <div style="background:#FAF6E8;border:1px solid #EAE3D0;border-radius:10px;padding:12px 14px;margin-bottom:18px;">
    <div style="font-size:11px;color:#6B7180;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;">Le mot du professionnel</div>
    <div style="font-size:14px;color:#0F1629;font-style:italic;">« ${escapeHtml(brief)} »</div>
  </div>`
      : ""
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
    <tr>
      <td style="padding:12px 14px;background:#0F1629;border-radius:10px;color:#FFFEF8;">
        <div style="font-size:11px;color:#A8AFC0;text-transform:uppercase;letter-spacing:.12em;">Récompense si vous acceptez</div>
        <div style="font-family:Georgia,serif;font-size:32px;font-weight:600;line-height:1.1;margin-top:4px;">${rewardStr} €</div>
        <div style="font-size:11.5px;color:#A8AFC0;margin-top:6px;">Délai pour répondre : <strong style="color:#FFFEF8;">${escapeHtml(expiresStr)}</strong></div>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 24px;text-align:center;">
    <a href="${LINK_URL}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:14px 28px;background:#4596EC;color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">
      Voir la demande →
    </a>
  </p>
  <p style="margin:0 0 4px;font-size:12px;color:#6B7180;text-align:center;">
    Sans réponse passé le délai, la demande expirera et aucun débit n'aura lieu.
  </p>
</td></tr>
<tr><td style="padding:18px 32px;background:#F7F4EC;border-top:1px solid #EAE3D0;text-align:center;">
  <a href="${APP_URL}" target="_blank" rel="noopener noreferrer">
    <img src="${LOGO_URL}" alt="BUUPP" width="100" style="display:inline-block;border:0;height:auto;max-width:100px;"/>
  </a>
  <p style="margin:10px 0 0;font-size:11px;color:#6B7180;line-height:1.5;">
    BUUPP — Be Used, Paid &amp; Proud · Vos données vous appartiennent.
  </p>
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
      `[email/relation] mail envoyé à ${email} — messageId=${info.messageId}` +
        (info.accepted?.length ? ` accepted=[${info.accepted.join(", ")}]` : "") +
        (info.rejected?.length ? ` rejected=[${info.rejected.join(", ")}]` : ""),
    );
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[email/relation] échec d'envoi à ${email} → ${msg}`);
  }
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "72 h";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
