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
  campaignEndsAt: string | null;     // ISO — date de clôture estimée
  authCode: string | null;           // 4 derniers caractères du code campagne
  founderBonusApplied?: boolean;     // ×2 standard appliqué
  founderVipBonusApplied?: boolean;  // +5,00 € flat appliqué (palier VIP, 10 filleul·es, budget > 300 €)
};

export async function sendRelationAccepted(
  params: RelationAcceptedParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const {
    email, prenom, proName, proSector, motif, rewardEur, campaignEndsAt, authCode,
    founderBonusApplied, founderVipBonusApplied,
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
    founderVipBonusApplied === true
      ? `🏆 Bonus parrain VIP appliqué\nVous touchez ${rewardStr} € au lieu de ${(rewardEur - 5).toFixed(2).replace(".", ",")} € grâce à votre palier VIP (10 filleul·es atteints) — bonus exceptionnel de +5,00 € par acceptation sur les campagnes > 300 €, pendant le 1er mois post-lancement.`
      : founderBonusApplied === true
        ? `🎖️ Bonus fondateur appliqué\nVous touchez ${rewardStr} € au lieu de ${(rewardEur / 2).toFixed(2).replace(".", ",")} € grâce à votre statut de fondateur·ice (+100 % sur le 1er mois post-lancement).`
        : null,
    (founderBonusApplied === true || founderVipBonusApplied === true) ? "" : null,
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFEF8;border-radius:18px;border:1px solid #EAE3D0;overflow:hidden;box-shadow:0 4px 24px -8px rgba(15,22,41,.08);">
<tr><td style="padding:0;">
  <!-- Bandeau header vert : confettis + titre -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#E6F7EE 0%,#D8F1E5 50%,#C9EFDD 100%);background-color:#E6F7EE;">
    <tr><td style="padding:24px 32px 18px;position:relative;">
      <!-- Confettis -->
      <div style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#10B981;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:10px;height:10px;background:#7C3AED;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #F59E0B;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4596EC;vertical-align:middle;"></div>
      <div style="margin-top:14px;">
        <div style="font-family:Georgia,serif;font-size:30px;font-weight:600;color:#0F1629;letter-spacing:-.01em;">BUUPP</div>
        <div style="font-size:11px;color:#047857;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;font-weight:600;">✓ Sollicitation acceptée</div>
      </div>
    </td></tr>
    <!-- Zigzag d'accent -->
    <tr><td style="height:14px;background-image:linear-gradient(135deg,#FFFEF8 25%,transparent 25%,transparent 50%,#FFFEF8 50%,#FFFEF8 75%,transparent 75%);background-size:14px 14px;line-height:0;font-size:0;">&nbsp;</td></tr>
  </table>

<tr><td style="padding:24px 32px 8px;">
  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#0F1629;font-weight:500;">
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
  <div style="background:#FAF6E8;border:1px solid #EAE3D0;border-left:4px solid #10B981;border-radius:10px;padding:12px 14px;margin-bottom:18px;">
    <div style="font-size:11px;color:#047857;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;font-weight:600;">◆ Objet de la demande</div>
    <div style="font-size:14px;color:#0F1629;">${escapeHtml(motif)}</div>
  </div>`
      : ""
  }

  <!-- Bloc récompense : gradient ink + cercles décoratifs -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;border-collapse:separate;">
    <tr>
      <td style="padding:18px 20px;background:#0F1629;background-image:linear-gradient(135deg,#1F2940 0%,#0F1629 60%,#0A1020 100%);border-radius:14px;color:#FFFEF8;position:relative;">
        <!-- Cercles décoratifs -->
        <div style="position:absolute;top:-10px;right:14px;width:28px;height:28px;border-radius:50%;background:rgba(16,185,129,0.30);"></div>
        <div style="position:absolute;bottom:-8px;right:46px;width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,0.10);"></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:.14em;font-weight:600;">🔒 Récompense en séquestre</div>
        <div style="font-family:Georgia,serif;font-size:36px;font-weight:600;line-height:1.1;margin-top:6px;letter-spacing:-.01em;">${rewardStr} €</div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.25);font-size:12px;color:rgba(255,255,255,0.92);">
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
      <td style="padding:14px 16px;background:#FFF7ED;border:1px solid #F4C99B;border-left:4px solid #F59E0B;border-radius:10px;">
        <div style="font-size:11px;color:#92400E;text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px;font-weight:600;">🔑 Code d'authentification BUUPP</div>
        <div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:26px;font-weight:600;letter-spacing:.18em;color:#0F1629;margin-bottom:8px;">${escapeHtml(authCode)}</div>
        <div style="font-size:12.5px;line-height:1.55;color:#3A4150;">
          Ce code vous sera communiqué par <strong>${escapeHtml(proName)}</strong> au moment de la prise de contact afin de confirmer l'authenticité de la sollicitation BUUPP. <strong>Une seule sollicitation par prospect est autorisée</strong> dans le cadre du service BUUPP.
        </div>
      </td>
    </tr>
  </table>`
      : ""
  }
  ${
    founderVipBonusApplied === true
      ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
    <tr>
      <td style="padding:14px 16px;background:linear-gradient(135deg,#FEF3C7 0%,#FDE68A 60%,#FCD34D 100%);background-color:#FEF3C7;border:1px solid #F59E0B;border-left:4px solid #B45309;border-radius:10px;">
        <div style="font-size:11px;color:#78350F;text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px;font-weight:700;">🏆 Bonus parrain VIP appliqué</div>
        <div style="font-size:14px;line-height:1.6;color:#0F1629;">
          Vous touchez <strong>${rewardStr} €</strong> au lieu de
          ${(rewardEur - 5).toFixed(2).replace(".", ",")} €
          grâce à votre <strong>palier VIP</strong> (10 filleul·es atteints) :
          <span style="color:#78350F;font-weight:700;">+5,00 € exceptionnels</span>
          par acceptation, pendant le 1er mois post-lancement, sur les
          campagnes &gt; 300 €.
        </div>
      </td>
    </tr>
  </table>`
      : founderBonusApplied === true
        ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
    <tr>
      <td style="padding:14px 16px;background:#FFFBEB;border:1px solid #F5D97E;border-left:4px solid #D97706;border-radius:10px;">
        <div style="font-size:11px;color:#92400E;text-transform:uppercase;letter-spacing:.12em;margin-bottom:6px;font-weight:600;">🎖️ Bonus fondateur appliqué</div>
        <div style="font-size:14px;line-height:1.6;color:#0F1629;">
          Vous touchez <strong>${rewardStr} €</strong> au lieu de
          ${(rewardEur / 2).toFixed(2).replace(".", ",")} €
          grâce à votre statut de fondateur·ice
          <span style="color:#92400E;font-weight:600;">(+100 % sur le 1er mois post-lancement)</span>.
        </div>
      </td>
    </tr>
  </table>`
        : ""
  }
  <p style="margin:0 0 14px;text-align:center;">
    <a href="${PORTEFEUILLE_URL}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:14px 32px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 100%);color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;box-shadow:0 4px 14px -4px rgba(69,150,236,.55);">
      Voir mon portefeuille →
    </a>
  </p>
  <!-- Petite ligne pointillée décorative -->
  <div style="text-align:center;margin:8px 0 4px;font-size:10px;letter-spacing:.6em;color:#C9D2E0;">● ● ● ● ●</div>
  <p style="margin:0;font-size:12px;color:#6B7180;text-align:center;line-height:1.5;">
    Plus vous participez, plus vos BUUPP coins grimpent. Continuez comme ça ✨
  </p>
</td></tr>

<!-- Footer avec triangles décoratifs -->
<tr><td style="padding:20px 32px 22px;background:#F7F4EC;border-top:1px solid #EAE3D0;text-align:center;">
  <div style="margin-bottom:12px;font-size:0;line-height:0;">
    <span style="display:inline-block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid #4596EC;margin:0 4px;"></span>
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#7C3AED;margin:0 4px;vertical-align:top;"></span>
    <span style="display:inline-block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid #F59E0B;margin:0 4px;"></span>
    <span style="display:inline-block;width:8px;height:8px;background:#10B981;transform:rotate(45deg);margin:0 4px;vertical-align:top;"></span>
    <span style="display:inline-block;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid #6D5BFF;margin:0 4px;"></span>
  </div>
  <a href="${APP_URL}" target="_blank" rel="noopener noreferrer">
    <img src="${LOGO_URL}" alt="BUUPP" width="100" style="display:inline-block;border:0;height:auto;max-width:100px;"/>
  </a>
  <p style="margin:10px 0 0;font-size:11px;color:#6B7180;line-height:1.5;">
    BUUPP — Be Used, Paid &amp; Proud · Vos données vous appartiennent.
  </p>
</td></tr>
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
