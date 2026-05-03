/**
 * Mail de confirmation envoyé après une inscription réussie sur la liste
 * d'attente BUUPP. Fire-and-forget côté API : on n'attend pas le retour
 * SMTP pour répondre au navigateur (latence E2E acceptable).
 */

import { getFromAddress, getTransport } from "./transport";

type ConfirmationParams = {
  email: string;
  prenom: string;
  ville: string;
  rank: number;
};

// URL publique du site BUUPP — utilisée pour le logo cliquable en bas du mail
// + la signature texte. Surchargeable via NEXT_PUBLIC_APP_URL en prod.
const BUUPP_SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const BUUPP_LOGO_URL = `${BUUPP_SITE_URL}/logo.png`;

export async function sendWaitlistConfirmation(
  params: ConfirmationParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const { email, prenom, ville, rank } = params;
  const formattedRank = rank.toLocaleString("fr-FR");

  const subject = `Bienvenue sur BUUPP — votre place est réservée (rang #${formattedRank})`;

  // Version texte (clients qui ne lisent pas le HTML).
  const text = [
    `Bonjour ${prenom},`,
    "",
    "Merci de rejoindre la liste d'attente BUUPP — la première plateforme",
    "qui rémunère les particuliers pour accepter d'être sollicités par les",
    "professionnels qui les ciblent vraiment.",
    "",
    `Votre rang sur la liste d'attente : #${formattedRank}`,
    `Ville renseignée : ${ville}`,
    "",
    "Ce que cela vous donne",
    "-----------------------",
    "  •  Accès prioritaire dès l'ouverture officielle",
    "  •  5 € de BUUPP Coins offerts à la création de votre compte",
    "  •  Statut « Prospect prioritaire » — gains doublés ×2 sur les premières",
    "     mises en relation",
    "",
    "À retenir",
    "----------",
    "Au lancement officiel, créez votre compte BUUPP avec EXACTEMENT cette",
    `même adresse e-mail (${email}). C'est la seule façon pour nous de`,
    "rattacher votre compte à votre place sur la liste — sinon les avantages",
    "de prospect prioritaire seront perdus.",
    "",
    "Faire monter votre rang",
    "------------------------",
    "Chaque ami qui s'inscrit avec votre lien de parrainage vous fait gagner",
    "des places sur la liste — top 500 dès 1 ami, top 100 dès 3 amis,",
    "statut VIP +20 € dès 10 amis.",
    "",
    "Nous vous préviendrons dès l'ouverture des inscriptions définitives.",
    "Restez à l'écoute, ça arrive très vite.",
    "",
    "À très bientôt,",
    "L'équipe BUUPP",
    "",
    BUUPP_SITE_URL,
    "",
    "—",
    "BUUPP — Be Used, Paid & Proud",
    "Vos données vous appartiennent. Vous décidez qui les utilise — et combien ça vaut.",
  ].join("\n");

  // Version HTML — palette indigo/ivoire BUUPP, sobre, mobile-friendly.
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F7F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0F1629;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F4EC;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFEF8;border-radius:16px;border:1px solid #EAE3D0;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:28px 32px 12px;border-bottom:1px solid #F1ECDB;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:600;letter-spacing:-0.02em;color:#0F1629;">BUUPP</div>
          <div style="font-size:12px;color:#6B7180;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">Liste d'attente prioritaire</div>
        </td></tr>

        <!-- Hero -->
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#0F1629;font-weight:500;">
            Félicitations ${escapeHtml(prenom)},<br/>votre place est réservée !
          </h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#3A4150;">
            Merci de rejoindre BUUPP — la première plateforme qui <strong>vous rémunère</strong> pour accepter d'être sollicité par les professionnels qui vous ciblent vraiment.
          </p>
        </td></tr>

        <!-- Rank card -->
        <tr><td style="padding:24px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0F1629;border-radius:12px;color:#FFFEF8;">
            <tr><td style="padding:22px 26px;">
              <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#A8AFC0;margin-bottom:6px;">Votre rang sur la liste</div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;font-weight:600;letter-spacing:-0.02em;line-height:1;">#${formattedRank}</div>
              <div style="font-size:12px;color:#A8AFC0;margin-top:8px;">Ville renseignée : ${escapeHtml(ville)}</div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Avantages -->
        <tr><td style="padding:24px 32px 8px;">
          <h2 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#0F1629;font-weight:500;">Vos avantages de prospect prioritaire</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:8px 0;border-bottom:1px solid #F1ECDB;">
              <span style="display:inline-block;width:20px;color:#4596EC;font-weight:700;">✓</span>
              <span style="font-size:14px;color:#3A4150;">Accès prioritaire dès l'ouverture officielle</span>
            </td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #F1ECDB;">
              <span style="display:inline-block;width:20px;color:#4596EC;font-weight:700;">✓</span>
              <span style="font-size:14px;color:#3A4150;"><strong>5 €</strong> de BUUPP Coins offerts à la création de votre compte</span>
            </td></tr>
            <tr><td style="padding:8px 0;">
              <span style="display:inline-block;width:20px;color:#4596EC;font-weight:700;">✓</span>
              <span style="font-size:14px;color:#3A4150;">Gains <strong>doublés ×2</strong> sur vos premières mises en relation</span>
            </td></tr>
          </table>
        </td></tr>

        <!-- Important : même adresse email -->
        <tr><td style="padding:20px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(120deg,#FEF3C7 0%,#FDE68A 100%);border:1px solid #F59E0B;border-radius:10px;">
            <tr><td style="padding:14px 18px;">
              <div style="font-size:13px;font-weight:700;color:#78350F;margin-bottom:4px;">⚠️ À retenir absolument</div>
              <div style="font-size:13px;line-height:1.55;color:#78350F;">
                Au lancement officiel, créez votre compte BUUPP avec <strong>exactement</strong> cette même adresse e-mail (<strong>${escapeHtml(email)}</strong>). C'est ce qui nous permettra de rattacher votre compte à votre place sur la liste — sinon vos avantages prioritaires seront perdus.
              </div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Parrainage -->
        <tr><td style="padding:20px 32px 0;">
          <h2 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#0F1629;font-weight:500;">Faites monter votre rang</h2>
          <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#3A4150;">
            Chaque ami qui s'inscrit avec votre lien vous fait gagner des places :
          </p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#6B7180;">
            • <strong>1 ami</strong> → top 500 &nbsp;&nbsp; • <strong>3 amis</strong> → top 100 &nbsp;&nbsp; • <strong>10 amis</strong> → statut VIP <strong>+20 €</strong>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#3A4150;">
            Nous vous préviendrons dès l'ouverture des inscriptions. Restez à l'écoute — ça arrive très vite.
          </p>
          <p style="margin:0 0 22px;font-size:14px;color:#3A4150;">À très bientôt,<br/><strong>L'équipe BUUPP</strong></p>
          <!-- Logo cliquable vers le site BUUPP -->
          <p style="margin:0;text-align:center;">
            <a href="${BUUPP_SITE_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
              <img src="${BUUPP_LOGO_URL}" alt="BUUPP" width="120" style="display:block;border:0;outline:none;height:auto;max-width:120px;"/>
            </a>
          </p>
        </td></tr>

        <!-- Bottom strip -->
        <tr><td style="padding:18px 32px;background:#F7F4EC;border-top:1px solid #EAE3D0;">
          <p style="margin:0;font-size:11px;line-height:1.5;color:#6B7180;text-align:center;">
            BUUPP — Be Used, Paid &amp; Proud<br/>
            Vos données vous appartiennent. Vous décidez qui les utilise — et combien ça vaut.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
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
      `[email/waitlist] mail envoyé à ${email} — messageId=${info.messageId}` +
        (info.accepted?.length ? ` accepted=[${info.accepted.join(", ")}]` : "") +
        (info.rejected?.length ? ` rejected=[${info.rejected.join(", ")}]` : ""),
    );
  } catch (err) {
    // Ne fait pas échouer l'inscription — on log et on continue.
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[email/waitlist] échec d'envoi à ${email} → ${msg}`);
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
