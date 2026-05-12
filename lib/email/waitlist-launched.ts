/**
 * Mail de lancement officiel envoyé à tous les inscrits de la liste
 * d'attente une fois la plateforme ouverte. Déclenché par l'endpoint
 * admin POST /api/admin/waitlist/launch-email (idempotent via la
 * colonne `waitlist.launch_email_sent_at`).
 *
 * Cible : utilisateurs qui sont dans `public.waitlist` avec
 * `launch_email_sent_at IS NULL`. À l'inscription Clerk avec le même
 * email, le trigger `sync_founder_status` les marquera fondateurs.
 */

import { getFromAddress, getTransport } from "./transport";

type LaunchedParams = {
  email: string;
  prenom: string;
};

const BUUPP_SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const BUUPP_LOGO_URL = `${BUUPP_SITE_URL}/logo.png`;
const SIGNUP_URL = `${BUUPP_SITE_URL}/inscription?from=waitlist-launch`;

export async function sendWaitlistLaunched(
  params: LaunchedParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const { email, prenom } = params;
  const subject = "🚀 C'est officiel — BUUPP est lancé !";

  const text = [
    `Bonjour ${prenom},`,
    "",
    "C'est officiel : BUUPP est ouvert.",
    "",
    "Vous êtes inscrit·e sur notre liste d'attente — vous pouvez",
    "maintenant créer votre compte et commencer à gagner de l'argent",
    "à chaque sollicitation acceptée.",
    "",
    "Vos avantages de parrain·e / fondateur·ice (réservés aux inscrits waitlist)",
    "----------------------------------------------------------------------------",
    "  •  Priorité de 10 minutes sur les flash deals — vous voyez les",
    "     meilleures sollicitations 10 min avant tout le monde.",
    "  •  Doublement des gains pendant le 1er mois — sur chaque",
    "     sollicitation acceptée, vous touchez 2× la récompense standard.",
    "  •  Code de parrainage personnel — invitez jusqu'à 10 filleul·es,",
    "     qui deviendront fondateur·ices à leur tour.",
    "  •  Palier VIP au plafond de 10 filleul·es — bonus forfaitaire de",
    "     +5,00 € par acceptation (à la place du ×2), sur les campagnes",
    "     de plus de 300 €, pendant le 1er mois post-lancement.",
    "  •  Badge fondateur·ice permanent sur votre profil.",
    "",
    "Comment activer vos avantages",
    "------------------------------",
    `Créez votre compte BUUPP avec exactement cette même adresse e-mail`,
    `(${email}). C'est ce qui nous permet de vous rattacher à votre`,
    "place sur la liste et d'activer automatiquement votre statut de",
    "fondateur·ice.",
    "",
    `Créer mon compte : ${SIGNUP_URL}`,
    "",
    "À tout de suite sur la plateforme,",
    "L'équipe BUUPP",
    "",
    BUUPP_SITE_URL,
    "",
    "—",
    "BUUPP — Be Used, Paid & Proud",
    "Vos données vous appartiennent. Vous décidez qui les utilise — et combien ça vaut.",
  ].join("\n");

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
          <div style="font-size:12px;color:#6B7180;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">Lancement officiel</div>
        </td></tr>

        <!-- Hero -->
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#0F1629;font-weight:500;">
            🚀 C'est officiel,<br/>BUUPP est lancé !
          </h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#3A4150;">
            Bonjour ${escapeHtml(prenom)}, vous êtes inscrit·e sur notre liste d'attente — la plateforme est désormais ouverte. Vous pouvez créer votre compte et commencer à <strong>gagner de l'argent</strong> à chaque sollicitation acceptée.
          </p>
        </td></tr>

        <!-- Founder benefits highlight -->
        <tr><td style="padding:24px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(120deg,#FFF8E1 0%,#FFF1B8 100%);border:1px solid #F2C879;border-radius:12px;">
            <tr><td style="padding:22px 26px;">
              <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#5C4400;margin-bottom:6px;font-weight:700;">🎖️ Vos avantages parrain·e / fondateur·ice</div>
              <div style="font-size:13px;line-height:1.55;color:#5C4400;">
                Parce que vous étiez là dès le début, vous gardez un statut spécial :
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
                <tr><td style="padding:6px 0;">
                  <span style="display:inline-block;width:18px;color:#5C4400;font-weight:700;">⚡</span>
                  <span style="font-size:13.5px;color:#5C4400;"><strong>Priorité de 10 minutes</strong> sur les flash deals — vous voyez les meilleures offres avant tout le monde.</span>
                </td></tr>
                <tr><td style="padding:6px 0;">
                  <span style="display:inline-block;width:18px;color:#5C4400;font-weight:700;">×2</span>
                  <span style="font-size:13.5px;color:#5C4400;"><strong>Doublement des gains</strong> pendant le 1er mois — chaque sollicitation acceptée vous rapporte 2× la récompense standard.</span>
                </td></tr>
                <tr><td style="padding:6px 0;">
                  <span style="display:inline-block;width:18px;color:#5C4400;font-weight:700;">👥</span>
                  <span style="font-size:13.5px;color:#5C4400;"><strong>Code de parrainage personnel</strong> — invitez jusqu'à 10 filleul·es, qui deviendront fondateur·ices à leur tour.</span>
                </td></tr>
                <tr><td style="padding:6px 0;">
                  <span style="display:inline-block;width:18px;color:#B45309;font-weight:700;">🏆</span>
                  <span style="font-size:13.5px;color:#5C4400;"><strong>Palier VIP</strong> au plafond de 10 filleul·es — bonus forfaitaire de <strong>+5,00 €</strong> par acceptation (à la place du ×2), sur les campagnes &gt; 300 €.</span>
                </td></tr>
                <tr><td style="padding:6px 0;">
                  <span style="display:inline-block;width:18px;color:#5C4400;font-weight:700;">🏷️</span>
                  <span style="font-size:13.5px;color:#5C4400;"><strong>Badge fondateur·ice</strong> permanent sur votre profil.</span>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA button -->
        <tr><td style="padding:28px 32px 8px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr><td style="background:#0F1629;border-radius:999px;">
              <a href="${SIGNUP_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#FFFEF8;text-decoration:none;letter-spacing:0.01em;">
                Créer mon compte →
              </a>
            </td></tr>
          </table>
          <p style="margin:14px 0 0;font-size:12px;color:#6B7180;">
            Inscription en 2 minutes, sans engagement.
          </p>
        </td></tr>

        <!-- Important : même email -->
        <tr><td style="padding:20px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFBEB;border:1px solid #D97706;border-radius:10px;">
            <tr><td style="padding:14px 18px;">
              <div style="font-size:13px;font-weight:700;color:#78350F;margin-bottom:4px;">⚠️ Activation de vos avantages</div>
              <div style="font-size:13px;line-height:1.55;color:#78350F;">
                Pour que votre statut fondateur·ice s'active automatiquement, créez votre compte avec <strong>exactement</strong> cette même adresse (<strong>${escapeHtml(email)}</strong>). Sinon, le rattachement à la liste sera perdu.
              </div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 22px;font-size:14px;color:#3A4150;">À tout de suite sur la plateforme,<br/><strong>L'équipe BUUPP</strong></p>
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

  const info = await transport.sendMail({
    from: getFromAddress(),
    to: email,
    subject,
    text,
    html,
  });
  console.log(
    `[email/waitlist-launched] envoyé à ${email} — messageId=${info.messageId}` +
      (info.accepted?.length ? ` accepted=[${info.accepted.join(", ")}]` : "") +
      (info.rejected?.length ? ` rejected=[${info.rejected.join(", ")}]` : ""),
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
