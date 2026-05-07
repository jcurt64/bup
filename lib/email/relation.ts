/**
 * Mail envoyé au prospect quand un pro lance une campagne ciblant son profil.
 * Fire-and-forget : appelé depuis `POST /api/pro/campaigns` en
 * `Promise.allSettled` non-await — un échec SMTP ne fait jamais échouer
 * la création de campagne.
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const PROSPECT_BASE = `${APP_URL}/prospect?tab=relations`;

export type RelationInvitationParams = {
  email: string;
  prenom: string | null;
  proName: string;
  proSector: string | null;
  motif: string;
  brief: string | null;
  rewardEur: number;
  /** True quand le bonus ×2 "certifié confiance" est appliqué.
   *  Ajoute un encart pédagogique dans l'email pour expliquer le doublage. */
  rewardDoubled?: boolean;
  expiresAt: string; // ISO
  /** ID de la relation. Permet au front de scroller / mettre en évidence
   *  la sollicitation correspondante après clic depuis le mail. */
  relationId?: string | null;
};

export async function sendRelationInvitation(
  params: RelationInvitationParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const {
    email,
    prenom,
    proName,
    proSector,
    motif,
    brief,
    rewardEur,
    rewardDoubled = false,
    expiresAt,
    relationId = null,
  } = params;

  const greet = prenom?.trim() || "Bonjour";
  const linkUrl = relationId
    ? `${PROSPECT_BASE}&relationId=${encodeURIComponent(relationId)}`
    : PROSPECT_BASE;
  const rewardStr = rewardEur.toFixed(2).replace(".", ",");
  const expiresStr = formatDeadline(expiresAt);

  const subject = `Nouvelle mise en relation — ${rewardStr} € à la clé`;

  const text = [
    `Bonjour ${greet},`,
    "",
    `${proName}${proSector ? " (" + proSector + ")" : ""} souhaite vous solliciter sur BUUPP.`,
    "",
    `Objet : ${motif}`,
    brief ? `Le mot du pro : « ${brief} »` : null,
    "",
    `Récompense si vous acceptez : ${rewardStr} €`,
    rewardDoubled
      ? "🎉 Vos gains sont doublés vu que votre profil est vérifié à 100% — quelle chance !"
      : null,
    `Délai pour répondre : ${expiresStr}`,
    "",
    "Vous pouvez accepter ou refuser depuis votre espace prospect :",
    linkUrl,
    "",
    "À bientôt,",
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
  <!-- Bandeau header avec confettis : 3 cercles + 1 carré incliné + un triangle -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#E8F0FE 0%,#F3EAFF 100%);background-color:#E8F0FE;">
    <tr><td style="padding:24px 32px 18px;position:relative;">
      <!-- Décor -->
      <div style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#4596EC;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:10px;height:10px;background:#7C3AED;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #F59E0B;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;vertical-align:middle;"></div>
      <div style="margin-top:14px;">
        <div style="font-family:Georgia,serif;font-size:30px;font-weight:600;color:#0F1629;letter-spacing:-.01em;">BUUPP</div>
        <div style="font-size:11px;color:#4596EC;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;font-weight:600;">✨ Nouvelle mise en relation</div>
      </div>
    </td></tr>
    <!-- Zigzag d'accent -->
    <tr><td style="height:14px;background-image:linear-gradient(135deg,#FFFEF8 25%,transparent 25%,transparent 50%,#FFFEF8 50%,#FFFEF8 75%,transparent 75%);background-size:14px 14px;line-height:0;font-size:0;">&nbsp;</td></tr>
  </table>

<tr><td style="padding:24px 32px 8px;">
  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;line-height:1.3;color:#0F1629;font-weight:500;">
    ${escapeHtml(greet)}, un pro vous propose ${rewardStr} €
  </h1>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3A4150;">
    <strong>${escapeHtml(proName)}</strong>${proSector ? ' <span style="color:#6B7180">— ' + escapeHtml(proSector) + "</span>" : ""} souhaite vous solliciter via BUUPP.
  </p>
  <p style="margin:0 0 4px;font-size:11px;color:#4596EC;letter-spacing:.12em;text-transform:uppercase;font-weight:600;">◆ Objet de la demande</p>
  <p style="margin:0 0 18px;font-size:14.5px;line-height:1.55;color:#0F1629;">${escapeHtml(motif)}</p>
  ${
    brief
      ? `
  <div style="background:#FAF6E8;border:1px solid #EAE3D0;border-left:4px solid #F59E0B;border-radius:10px;padding:12px 14px;margin-bottom:18px;">
    <div style="font-size:11px;color:#B45309;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;font-weight:600;">💬 Le mot du professionnel</div>
    <div style="font-size:14px;color:#0F1629;font-style:italic;">« ${escapeHtml(brief)} »</div>
  </div>`
      : ""
  }

  <!-- Bloc récompense : gradient bleu→violet + cercle décoratif d'angle -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;border-collapse:separate;">
    <tr>
      <td style="padding:18px 20px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 60%,#7C3AED 100%);border-radius:14px;color:#FFFEF8;position:relative;">
        <!-- Cercles décoratifs -->
        <div style="position:absolute;top:-10px;right:14px;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.18);"></div>
        <div style="position:absolute;bottom:-8px;right:46px;width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,0.10);"></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:.14em;font-weight:600;">🎁 Récompense si vous acceptez</div>
        <div style="font-family:Georgia,serif;font-size:36px;font-weight:600;line-height:1.1;margin-top:6px;letter-spacing:-.01em;">${rewardStr} €${rewardDoubled ? ' <span style="font-family:-apple-system,sans-serif;font-size:11px;background:#FFFEF8;color:#7C3AED;padding:3px 9px;border-radius:999px;letter-spacing:.04em;vertical-align:middle;font-weight:700;">×2 Bonus</span>' : ""}</div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.25);font-size:12px;color:rgba(255,255,255,0.92);">⏱ Délai pour répondre : <strong style="color:#FFFEF8;">${escapeHtml(expiresStr)}</strong></div>
      </td>
    </tr>
  </table>
  ${
    rewardDoubled
      ? `
  <div style="background:linear-gradient(135deg,#F3EAFF 0%,#FFEDF6 100%);background-color:#F3EAFF;border:1px solid #C9B5F2;border-radius:12px;padding:14px 16px;margin-bottom:18px;color:#3F2670;font-size:14px;line-height:1.5;">
    🎉 <strong>Vos gains sont doublés</strong> vu que votre profil est vérifié à 100% — quelle chance ! Le bonus ×2 est automatiquement appliqué : si vous acceptez, vous touchez le double de la récompense initiale.
  </div>`
      : ""
  }
  <p style="margin:0 0 14px;text-align:center;">
    <a href="${linkUrl}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:14px 32px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 100%);color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;box-shadow:0 4px 14px -4px rgba(69,150,236,.55);">
      Voir la demande →
    </a>
  </p>
  <!-- Petite ligne pointillée décorative -->
  <div style="text-align:center;margin:8px 0 4px;font-size:10px;letter-spacing:.6em;color:#C9D2E0;">● ● ● ● ●</div>
  <p style="margin:0;font-size:12px;color:#6B7180;text-align:center;line-height:1.5;">
    Passé ce délai, la demande expirera automatiquement.
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
      `[email/relation] mail envoyé à ${email} — messageId=${info.messageId}` +
        (info.accepted?.length ? ` accepted=[${info.accepted.join(", ")}]` : "") +
        (info.rejected?.length ? ` rejected=[${info.rejected.join(", ")}]` : ""),
    );
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[email/relation] échec d'envoi à ${email} → ${msg}`);
  }
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
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
