/**
 * Mail envoyé aux prospects qui n'ont ni accepté ni refusé une
 * sollicitation, lorsque la campagne associée arrive à 15 minutes de
 * sa clôture (campaigns.ends_at − now() <= 15 min).
 *
 * Idempotence : le helper `lib/lifecycle/campaign.ts` flagge
 * `campaigns.expiry_warning_sent = true` après envoi pour ne pas
 * réémettre. Fire-and-forget côté SMTP.
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const RELATIONS_URL = `${APP_URL}/prospect?tab=relations`;

export type CampaignExpiringSoonParams = {
  email: string;
  prenom: string | null;
  proName: string;
  rewardEur: number;
  campaignEndsAt: string | null;
};

export async function sendCampaignExpiringSoon(
  params: CampaignExpiringSoonParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const { email, prenom, proName, rewardEur, campaignEndsAt } = params;
  const greet = prenom?.trim() || "Bonjour";
  const rewardStr = rewardEur.toFixed(2).replace(".", ",");
  const endsLabel = formatDeadline(campaignEndsAt);
  const subject = `⏳ La campagne expire bientôt — ${rewardStr} € à empocher`;

  const text = [
    `Bonjour ${greet},`,
    "",
    `La campagne de ${proName} expire bientôt (${endsLabel}).`,
    "",
    `Profitez-en dès maintenant pour empocher vos ${rewardStr} € BUUPP coins.`,
    "Un seul clic suffit pour accepter :",
    RELATIONS_URL,
    "",
    "À tout de suite ?",
    "L'équipe BUUPP",
  ].join("\n");

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
  <div style="font-size:12px;color:#6B7180;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">Dernier rappel</div>
</td></tr>
<tr><td style="padding:28px 32px 8px;">
  <h1 style="margin:0 0 8px;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#0F1629;font-weight:500;">
    ⏳ ${escapeHtml(greet)}, la campagne expire bientôt
  </h1>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3A4150;">
    La campagne de <strong>${escapeHtml(proName)}</strong> se ferme à
    <strong>${escapeHtml(endsLabel)}</strong>. Profitez-en pour empocher
    vos <strong>${rewardStr} €</strong> BUUPP coins avant qu'elle ne se clôture.
  </p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
    <tr>
      <td style="padding:14px 16px;background:#0F1629;border-radius:10px;color:#FFFEF8;">
        <div style="font-size:11px;color:#A8AFC0;text-transform:uppercase;letter-spacing:.12em;">À empocher</div>
        <div style="font-family:Georgia,serif;font-size:32px;font-weight:600;line-height:1.1;margin-top:4px;">${rewardStr} €</div>
        <div style="font-size:11.5px;color:#A8AFC0;margin-top:6px;">
          Sans réponse, la sollicitation expire automatiquement.
        </div>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 22px;text-align:center;">
    <a href="${RELATIONS_URL}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:14px 28px;background:#4596EC;color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">
      Accepter maintenant →
    </a>
  </p>
  <p style="margin:0 0 4px;font-size:12px;color:#6B7180;text-align:center;">
    Un seul clic suffit. ✨
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
      `[email/expiring-soon] mail envoyé à ${email} — messageId=${info.messageId}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[email/expiring-soon] échec d'envoi à ${email} → ${msg}`);
  }
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "prochainement";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "prochainement";
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
