/**
 * Mail de lancement officiel envoyé à tous les inscrits de la liste
 * d'attente une fois la plateforme ouverte. Déclenché par l'endpoint
 * admin POST /api/admin/waitlist/launch-email (idempotent via la
 * colonne `waitlist.launch_email_sent_at`).
 *
 * Cible : utilisateurs qui sont dans `public.waitlist` avec
 * `launch_email_sent_at IS NULL`. À l'inscription Clerk avec le même
 * email, le trigger `sync_founder_status` les marquera fondateurs —
 * d'où l'insistance du mail sur « la même adresse », qui est le seul
 * point de rattachement et ne se rattrape pas à la main.
 *
 * ⚠️ Les avantages énoncés ici doivent rester alignés sur ceux affichés
 * dans `public/prototype/waitlist.html` (section « Les avantages des
 * fondateurs ») et sur les paliers Used / Paid / Proud de
 * `public/prototype/components/Prospect.jsx` (REFERRAL_TIERS). Le ×2
 * fondateur et le palier VIP +5 € ont été SUPPRIMÉS le 28/05/2026 : ne
 * pas les réintroduire ici.
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
const SIGNUP_URL = `${BUUPP_SITE_URL}/inscription/prospect?from=waitlist-launch`;

export async function sendWaitlistLaunched(
  params: LaunchedParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const { email, prenom } = params;
  const subject = "🚀 C'est ouvert ! Votre place de fondateur·ice vous attend";

  const text = [
    `Bonjour ${prenom},`,
    "",
    "Un mois d'attente, beaucoup de code et un nombre déraisonnable de",
    "cafés plus tard : BUUPP ouvre ses portes. Maintenant. Pour de vrai. 🎉",
    "",
    "Vous vous étiez pré-inscrit·e. Votre place de fondateur·ice est",
    "réservée, votre badge est prêt — il ne manque plus que vous.",
    "",
    `Créer mon compte : ${SIGNUP_URL}`,
    "",
    "⚠️ UN SEUL DÉTAIL, MAIS IL EST CAPITAL",
    "--------------------------------------",
    "Créez votre compte avec EXACTEMENT la même adresse e-mail que votre",
    `pré-inscription, c'est-à-dire ${email}.`,
    "",
    "C'est elle, et elle seule, qui vous rattache à votre place sur la",
    "liste. Avec une autre adresse, vous arrivez en simple nouveau venu :",
    "pas de badge, pas de bonus, pas de 50 %. Et non, on ne peut pas le",
    "rattraper à la main — c'est automatique, des deux côtés.",
    "",
    "CE QUI VOUS ATTEND DERRIÈRE LE BOUTON",
    "--------------------------------------",
    "  🥉 Used — 5,00 € de bonus fondateur inscrits à votre portefeuille",
    "     dès l'ouverture du compte. Ils deviennent débloquables après",
    "     3 mois d'ancienneté ET votre première sollicitation acceptée ;",
    "     on vous prévient, vous les débloquez d'un clic. Ils n'expirent",
    "     jamais.",
    "     Et dès votre 1er filleul : +50 % de sa récompense à chacune de",
    "     ses acceptations, à vie.",
    "",
    "  🥈 Paid — à partir de 3 filleuls : les offres flash 20 minutes",
    "     avant tout le monde. Sur un flash deal, 20 minutes, c'est",
    "     une éternité.",
    "",
    "  🥇 Proud — à 10 filleuls : statut Governor, consulté·e avec droit",
    "     de vote sur les nouveautés de la plateforme.",
    "",
    "LE PRINCIPE, EN UNE PHRASE",
    "---------------------------",
    "Ce sont les professionnels qui paient pour avoir le droit de vous",
    "solliciter. Vous acceptez : vous êtes payé·e. Vous refusez : il ne",
    "se passe rien. Vos données ne bougent pas d'un pixel sans votre",
    "feu vert.",
    "",
    "Bienvenue chez les fondateur·ices,",
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
          <div style="font-size:12px;color:#6B7180;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">Les inscriptions sont ouvertes</div>
        </td></tr>

        <!-- Hero -->
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#0F1629;font-weight:500;">
            🚀 C'est ouvert.<br/>Et votre place vous attend.
          </h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3A4150;">
            Bonjour ${escapeHtml(prenom)}, un mois d'attente, beaucoup de code et un nombre déraisonnable de cafés plus tard : <strong>BUUPP ouvre ses portes.</strong> Maintenant. Pour de vrai. 🎉
          </p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#3A4150;">
            Vous vous étiez pré-inscrit·e. Votre place de <strong>fondateur·ice</strong> est réservée, votre badge est prêt — il ne manque plus que vous.
          </p>
        </td></tr>

        <!-- CTA button -->
        <tr><td style="padding:26px 32px 6px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr><td style="background:#0F1629;border-radius:999px;">
              <a href="${SIGNUP_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 34px;font-size:15px;font-weight:600;color:#FFFEF8;text-decoration:none;letter-spacing:0.01em;">
                Créer mon compte →
              </a>
            </td></tr>
          </table>
          <p style="margin:14px 0 0;font-size:12px;color:#6B7180;">
            2 minutes, sans engagement.
          </p>
        </td></tr>

        <!-- Le point capital : la même adresse -->
        <tr><td style="padding:22px 32px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFBEB;border:1px solid #D97706;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-size:13.5px;font-weight:700;color:#78350F;margin-bottom:8px;">⚠️ Un seul détail, mais il est capital</div>
              <div style="font-size:13.5px;line-height:1.6;color:#78350F;">
                Créez votre compte avec <strong>exactement la même adresse e-mail</strong> que votre pré-inscription :
                <div style="margin:10px 0;padding:10px 14px;background:#FFFFFF;border:1px dashed #D97706;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13.5px;color:#78350F;word-break:break-all;">${escapeHtml(email)}</div>
                C'est elle, et elle seule, qui vous rattache à votre place sur la liste. Avec une autre adresse, vous arrivez en simple nouveau venu : pas de badge, pas de bonus, pas de 50 %. Et non, on ne peut pas le rattraper à la main — c'est automatique, des deux côtés.
              </div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Avantages fondateur -->
        <tr><td style="padding:24px 32px 8px;">
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6B7180;font-weight:700;margin-bottom:12px;">Ce qui vous attend derrière le bouton</div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FDF1E5;border:1px solid #D9A066;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-size:14px;font-weight:700;color:#7A431A;margin-bottom:6px;">🥉 Used — votre bonus de départ</div>
              <div style="font-size:13.5px;line-height:1.6;color:#7A431A;">
                <strong>5,00 €</strong> inscrits à votre portefeuille dès l'ouverture du compte. Ils deviennent débloquables après <strong>3 mois d'ancienneté</strong> et votre <strong>première sollicitation acceptée</strong> : on vous prévient, vous les débloquez d'un clic. Ils n'expirent jamais.
                <br/><br/>
                Et dès votre 1<sup>er</sup> filleul : <strong>+50 % de sa récompense</strong> à chacune de ses acceptations, à vie.
              </div>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;background:#F3F4F6;border:1px solid #D1D5DB;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-size:14px;font-weight:700;color:#374151;margin-bottom:6px;">🥈 Paid — 20 minutes d'avance</div>
              <div style="font-size:13.5px;line-height:1.6;color:#374151;">
                À partir de <strong>3 filleuls</strong>, vous voyez les offres flash <strong>20 minutes avant tout le monde</strong>. Sur un flash deal, 20 minutes, c'est une éternité.
              </div>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;background:#FEF3C7;border:1px solid #E6B422;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-size:14px;font-weight:700;color:#78350F;margin-bottom:6px;">🥇 Proud — vous avez voix au chapitre</div>
              <div style="font-size:13.5px;line-height:1.6;color:#78350F;">
                À <strong>10 filleuls</strong>, vous passez <strong>Governor</strong> : consulté·e avec droit de vote sur les nouveautés de la plateforme.
              </div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Rappel du principe -->
        <tr><td style="padding:24px 32px 4px;">
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6B7180;font-weight:700;margin-bottom:8px;">Le principe, en une phrase</div>
          <p style="margin:0;font-size:14px;line-height:1.65;color:#3A4150;">
            Ce sont les <strong>professionnels qui paient</strong> pour avoir le droit de vous solliciter. Vous acceptez : vous êtes payé·e. Vous refusez : il ne se passe rien. Vos données ne bougent pas d'un pixel sans votre feu vert.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:26px 32px 8px;">
          <p style="margin:0 0 22px;font-size:14px;color:#3A4150;">Bienvenue chez les fondateur·ices,<br/><strong>L'équipe BUUPP</strong></p>
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
