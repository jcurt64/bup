/**
 * Mail envoyé au PROSPECT GAGNANT d'un FREEBUUPP.
 *
 * Ton festif et clair : on annonce le gain, on rappelle le lot et la marque,
 * et on prévient que le professionnel le contactera par téléphone (seul le
 * numéro du gagnant est révélé au pro). Fire-and-forget côté appelant.
 */

import { getFromAddress, getReplyToAddress, safeSendMail } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;

export type FreebuuppWinnerParams = {
  /** E-mail du gagnant (issu de prospect_identity.email). */
  email: string;
  /** Prénom du gagnant (optionnel). */
  prenom: string | null;
  /** Raison sociale de la marque organisatrice. */
  brand: string;
  /** Titre du FREEBUUPP. */
  title: string;
  /** Description du lot gagné. */
  prize: string;
  /** Numéro de participant tiré (le « ticket »). */
  participantNumber: number;
  /** Code public du FREEBUUPP (pour le lien). */
  code: string;
};

export async function sendFreebuuppWinnerEmail(params: FreebuuppWinnerParams): Promise<void> {
  const { email, prenom, brand, title, prize, participantNumber, code } = params;
  const greet = prenom?.trim() ? `Bonjour ${prenom.trim()}` : "Bonjour";
  const url = `${APP_URL}/freebuupp/${encodeURIComponent(code)}`;
  const subject = `🎉 Vous avez gagné le FREEBUUPP « ${title} » !`;

  const text = [
    `${greet},`,
    "",
    `Félicitations ! Votre numéro #${participantNumber} a été tiré au sort.`,
    `Vous remportez : ${prize} (offert par ${brand}).`,
    "",
    `${brand} va vous contacter par téléphone pour la remise de votre lot.`,
    "",
    `Détail du tirage (vérifiable) : ${url}`,
    "",
    "L'équipe BUUPP",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto">
      <p><img src="${LOGO_URL}" alt="BUUPP" height="40" /></p>
      <h2 style="margin:0 0 8px">🎉 Vous avez gagné !</h2>
      <p>${greet},</p>
      <p>Félicitations ! Votre numéro <strong>#${participantNumber}</strong> a été tiré au sort
      lors du FREEBUUPP <strong>« ${title} »</strong>.</p>
      <p>Vous remportez : <strong>${prize}</strong> — offert par <strong>${brand}</strong>.</p>
      <p><strong>${brand} va vous contacter par téléphone</strong> pour la remise de votre lot.</p>
      <p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Voir le tirage vérifié 🔒</a></p>
      <p style="color:#666;font-size:13px">L'équipe BUUPP</p>
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
