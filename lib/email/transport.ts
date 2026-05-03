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

// On cache uniquement les transports VALIDES (non-null). Si la config était
// absente au démarrage et a été ajoutée depuis, on retentera la création
// au prochain appel — pas besoin de redémarrer le serveur.
let cachedTransport: Transporter | null = null;
let cachedFor: string | null = null; // signature user|host|port pour invalider

export function getTransport(): Transporter | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? 465);

  if (!user || !pass) {
    if (cachedTransport) {
      cachedTransport.close();
      cachedTransport = null;
      cachedFor = null;
    }
    console.warn(
      "[email] SMTP_USER / SMTP_PASS non définis — l'envoi de mails est désactivé. " +
        "Configurez ces variables dans .env.local pour activer les confirmations.",
    );
    return null;
  }

  const signature = `${user}|${host}|${port}`;
  if (cachedTransport && cachedFor === signature) return cachedTransport;

  // Reconfigurer si la signature a changé.
  if (cachedTransport) cachedTransport.close();

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // SSL implicite sur 465, STARTTLS sur 587.
    auth: { user, pass },
  });
  cachedFor = signature;

  return cachedTransport;
}

export function getFromAddress(): string {
  // Permet de personnaliser le "from" (ex: "BUUPP <jjlex64@gmail.com>") via env.
  return process.env.MAIL_FROM ?? `BUUPP <${process.env.SMTP_USER ?? "jjlex64@gmail.com"}>`;
}
