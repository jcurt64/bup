/**
 * Transport SMTP partagé (Gmail).
 *
 * Configuration via variables d'environnement :
 *   - SMTP_HOST   (défaut : smtp.gmail.com)
 *   - SMTP_PORT   (défaut : 465)
 *   - SMTP_USER   = adresse Gmail de l'expéditeur (jjlex64@gmail.com)
 *   - SMTP_PASS   = mot de passe d'application Google (16 caractères, sans espaces)
 *                   → https://myaccount.google.com/apppasswords (2FA requise)
 *
 * Si SMTP_USER ou SMTP_PASS manquent, `getTransport()` retourne `null` →
 * les fonctions d'envoi loggent un avertissement et reviennent silencieusement
 * (pas d'erreur HTTP, l'inscription reste fonctionnelle même sans mail).
 */

import nodemailer, { type Transporter } from "nodemailer";

let cachedTransport: Transporter | null | undefined;

export function getTransport(): Transporter | null {
  if (cachedTransport !== undefined) return cachedTransport;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn(
      "[email] SMTP_USER / SMTP_PASS non définis — l'envoi de mails est désactivé. " +
      "Configurez ces variables dans .env.local pour activer les confirmations.",
    );
    cachedTransport = null;
    return null;
  }

  const port = Number(process.env.SMTP_PORT ?? 465);
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: port === 465, // SSL implicite sur 465, STARTTLS sur 587.
    auth: { user, pass },
  });

  return cachedTransport;
}

export function getFromAddress(): string {
  // Permet de personnaliser le "from" (ex: "BUUPP <jjlex64@gmail.com>") via env.
  return process.env.MAIL_FROM ?? `BUUPP <${process.env.SMTP_USER ?? "jjlex64@gmail.com"}>`;
}
