/**
 * Mail envoyé au prospect immédiatement après qu'il a accepté une
 * sollicitation d'un pro. Ton joyeux, légèrement fantaisiste — on
 * confirme la mise en séquestre et on rappelle la mécanique BUUPP
 * (déblocage à la clôture de la campagne).
 *
 * Fire-and-forget : appelé depuis /api/prospect/relations/[id]/decision
 * via Promise.allSettled non-await. Une panne SMTP n'a jamais d'impact
 * sur le flux d'acceptation.
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const PORTEFEUILLE_URL = `${APP_URL}/prospect?tab=portefeuille`;

export type RelationAcceptedParams = {
  email: string;
  prenom: string | null;
  proName: string;
  proSector: string | null;
  motif: string | null;
  rewardEur: number;
  campaignEndsAt: string | null; // ISO — date de clôture estimée
  authCode: string | null;       // 4 derniers caractères du code campagne
};

export async function sendRelationAccepted(
  params: RelationAcceptedParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const {
    email, prenom, proName, proSector, motif, rewardEur, campaignEndsAt, authCode,
  } = params;

  const greet = prenom?.trim() || "Bonjour";
  const rewardStr = rewardEur.toFixed(2).replace(".", ",");
  const endsLabel = formatDeadline(campaignEndsAt);
  const subject = `Bravo ${greet} — vos ${rewardStr} € sont en route 🎉`;

  const text = [
    `Bravo ${greet} !`,
    "",
    `Vous venez d'accepter la sollicitation de ${proName}${proSector ? " (" + proSector + ")" : ""}.`,
    motif ? `\nObjet : ${motif}` : null,
    "",
    `Vos ${rewardStr} € sont mis en séquestre dès maintenant.`,
    `Ils seront automatiquement crédités sur votre portefeuille à la clôture de la campagne (${endsLabel}).`,
    "",
    authCode
      ? `Code d'authentification BUUPP : ${authCode}\nCe code vous sera communiqué par ${proName} lors de la prise de contact afin de confirmer l'authenticité de la sollicitation BUUPP. Une seule sollicitation par prospect est autorisée dans le cadre du service BUUPP.`
      : null,
    "",
    "Vous pouvez suivre votre solde à tout moment sur :",
    PORTEFEUILLE_URL,
    "",
    "Merci pour votre confiance — c'est exactement comme ça que BUUPP fait progresser tout le monde.",
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
  <div style="font-size:12px;color:#6B7180;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">Sollicitation acceptée</div>
</td></tr>
<tr><td style="padding:28px 32px 8px;">
  <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#0F1629;font-weight:500;">
    Bravo ${escapeHtml(greet)} 🎉
  </h1>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3A4150;">
    Vous venez d'accepter la sollicitation de
    <strong>${escapeHtml(proName)}</strong>${proSector ? ' <span style="color:#6B7180">— ' + escapeHtml(proSector) + "</span>" : ""}.
    Bien joué — c'est exactement comme ça qu'on encaisse ses BUUPP coins.
  </p>
  ${
    motif
      ? `
  <div style="background:#FAF6E8;border:1px solid #EAE3D0;border-radius:10px;padding:12px 14px;margin-bottom:18px;">
    <div style="font-size:11px;color:#6B7180;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;">Objet de la demande</div>
    <div style="font-size:14px;color:#0F1629;">${escapeHtml(motif)}</div>
  </div>`
      : ""
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
    <tr>
      <td style="padding:14px 16px;background:#0F1629;border-radius:10px;color:#FFFEF8;">
        <div style="font-size:11px;color:#A8AFC0;text-transform:uppercase;letter-spacing:.12em;">Récompense en séquestre</div>
        <div style="font-family:Georgia,serif;font-size:32px;font-weight:600;line-height:1.1;margin-top:4px;">${rewardStr} €</div>
        <div style="font-size:11.5px;color:#A8AFC0;margin-top:6px;">
          Encaissement automatique à la clôture de la campagne — <strong style="color:#FFFEF8;">${escapeHtml(endsLabel)}</strong>.
        </div>
      </td>
    </tr>
  </table>
  ${
    authCode
      ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
    <tr>
      <td style="padding:14px 16px;background:#FFF7ED;border:1px solid #F4C99B;border-radius:10px;">
        <div style="font-size:11px;color:#92400E;text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px;">Code d'authentification BUUPP</div>
        <div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:26px;font-weight:600;letter-spacing:.18em;color:#0F1629;margin-bottom:8px;">${escapeHtml(authCode)}</div>
        <div style="font-size:12.5px;line-height:1.55;color:#3A4150;">
          Ce code vous sera communiqué par <strong>${escapeHtml(proName)}</strong> au moment de la prise de contact afin de confirmer l'authenticité de la sollicitation BUUPP. <strong>Une seule sollicitation par prospect est autorisée</strong> dans le cadre du service BUUPP.
        </div>
      </td>
    </tr>
  </table>`
      : ""
  }
  <p style="margin:0 0 22px;text-align:center;">
    <a href="${PORTEFEUILLE_URL}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:14px 28px;background:#4596EC;color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">
      Voir mon portefeuille →
    </a>
  </p>
  <p style="margin:0 0 4px;font-size:12px;color:#6B7180;text-align:center;">
    Plus vous participez, plus vos BUUPP coins grimpent. Continuez comme ça ✨
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
      `[email/relation-accepted] mail envoyé à ${email} — messageId=${info.messageId}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[email/relation-accepted] échec d'envoi à ${email} → ${msg}`);
  }
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "à venir";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "à venir";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
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
