/**
 * Mail GROUPÉ de consolation envoyé aux prospects NON tirés au sort d'un
 * FREEBUUPP. Le professionnel y présente ses services. Envoi UNIQUE par
 * FREEBUUPP (verrouillé côté serveur via `consolation_sent_at`).
 *
 * Chaque destinataire reçoit son propre mail (pas de fuite d'adresses entre
 * participants). Le message est rédigé par le pro et inséré tel quel (échappé).
 */

import { getFromAddress, getReplyToAddress, safeSendMail } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type FreebuuppConsolationParams = {
  email: string;
  prenom: string | null;
  brand: string;
  title: string;
  /** Message libre rédigé par le professionnel. */
  message: string;
};

export async function sendFreebuuppConsolationEmail(params: FreebuuppConsolationParams): Promise<void> {
  const { email, prenom, brand, title, message } = params;
  const greet = prenom?.trim() ? `Bonjour ${prenom.trim()}` : "Bonjour";
  const subject = `${brand} — suite au FREEBUUPP « ${title} »`;
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");

  const text = [
    `${greet},`,
    "",
    `Vous avez participé au FREEBUUPP « ${title} » organisé par ${brand}.`,
    `Le tirage au sort ne vous a pas désigné cette fois-ci — mais ${brand} souhaitait vous adresser un message :`,
    "",
    message,
    "",
    "— Message envoyé via BUUPP. Vous recevez ce mail car vous avez participé à ce tirage.",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto">
      <p><img src="${LOGO_URL}" alt="BUUPP" height="40" /></p>
      <p>${greet},</p>
      <p>Vous avez participé au FREEBUUPP <strong>« ${escapeHtml(title)} »</strong> organisé par
      <strong>${escapeHtml(brand)}</strong>. Le tirage ne vous a pas désigné cette fois-ci, mais
      ${escapeHtml(brand)} souhaitait vous adresser ce message&nbsp;:</p>
      <blockquote style="border-left:3px solid #ddd;margin:0;padding:8px 16px;color:#333">${safeMessage}</blockquote>
      <p style="color:#999;font-size:12px;margin-top:24px">Message envoyé via BUUPP. Vous recevez ce mail
      car vous avez participé à ce tirage au sort.</p>
    </div>`;

  await safeSendMail({
    from: getFromAddress(),
    replyTo: getReplyToAddress(),
    to: email,
    subject,
    text,
    html,
  });
}
