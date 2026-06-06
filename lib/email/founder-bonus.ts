/**
 * Email de confirmation du bonus fondateur 5 € (calqué sur
 * lib/email/waitlist.ts). `renderFounderBonusEmail` est pur et testable ;
 * `sendFounderBonusEmail` passe par safeSendMail (ne lève jamais).
 */
import {
  safeSendMail,
  getFromAddress,
  getReplyToAddress,
} from "@/lib/email/transport";

export type FounderBonusParams = { prenom: string | null };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderFounderBonusEmail(params: FounderBonusParams): {
  subject: string;
  text: string;
  html: string;
} {
  const prenom = (params.prenom ?? "").trim();
  const hello = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const helloHtml = prenom ? `Bonjour ${escapeHtml(prenom)},` : "Bonjour,";
  const subject = "Votre bonus fondateur est arrivé 🎁";

  const text = [
    hello,
    "",
    "Merci d'avoir rejoint BUUPP dès la liste d'attente !",
    "Pour vous remercier, nous venons de créditer 5,00 € de bonus fondateur",
    "sur votre portefeuille. Il est dès maintenant disponible et retirable.",
    "",
    "Bienvenue parmi les tout premiers membres.",
    "L'équipe BUUPP",
  ].join("\n");

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Votre bonus fondateur</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5;">
    <p>${helloHtml}</p>
    <p>Merci d'avoir rejoint BUUPP dès la liste d'attente !</p>
    <p>Pour vous remercier, nous venons de créditer
       <strong>5,00 € de bonus fondateur</strong> sur votre portefeuille.
       Il est dès maintenant disponible et retirable.</p>
    <p>Bienvenue parmi les tout premiers membres.<br/>— L'équipe BUUPP</p>
  </body></html>`;

  return { subject, text, html };
}

export async function sendFounderBonusEmail(
  email: string,
  params: FounderBonusParams,
): Promise<void> {
  const { subject, text, html } = renderFounderBonusEmail(params);
  await safeSendMail({
    to: email,
    from: getFromAddress(),
    replyTo: getReplyToAddress(),
    subject,
    text,
    html,
  });
}
