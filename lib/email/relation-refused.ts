/**
 * Mail envoyé au prospect qui vient de refuser une sollicitation. Ton
 * jovial — on accepte le "non" mais on rappelle que la décision est
 * réversible tant que la campagne est ouverte, et on recueille un
 * feedback rapide via 3 boutons (entreprise douteuse / faible
 * rémunération / pas intéressé). Chaque bouton pointe vers
 *   /feedback?relationId=…&reason=…
 * qui affiche une page de confirmation BUUPP "Merci pour votre avis".
 *
 * Fire-and-forget : appelé depuis /api/prospect/relations/[id]/decision
 * (action='refuse') via Promise.allSettled non-await.
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const RELATIONS_URL = `${APP_URL}/prospect?tab=relations`;

export type RelationRefusedParams = {
  email: string;
  prenom: string | null;
  proName: string;
  relationId: string;
  rewardEur: number;
  campaignEndsAt: string | null;
};

const FEEDBACK_REASONS = [
  { key: "entreprise-douteuse", label: "Entreprise douteuse" },
  { key: "faible-remuneration", label: "Faible rémunération" },
  { key: "pas-interesse",       label: "Pas intéressé" },
] as const;

export async function sendRelationRefused(
  params: RelationRefusedParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const { email, prenom, proName, relationId, rewardEur, campaignEndsAt } = params;
  const greet = prenom?.trim() || "Bonjour";
  const rewardStr = rewardEur.toFixed(2).replace(".", ",");
  const endsLabel = formatDeadline(campaignEndsAt);
  const subject = `Oups — vous n'avez pas accepté la sollicitation de ${proName}`;

  const feedbackUrl = (key: string) =>
    `${APP_URL}/feedback?relationId=${encodeURIComponent(relationId)}&reason=${encodeURIComponent(key)}`;

  const text = [
    `Bonjour ${greet},`,
    "",
    `Cette campagne de ${proName} ne semble pas vous avoir intéressé(e) — pas de souci, on respecte.`,
    "",
    `Bon à savoir : vous pouvez toujours revenir sur votre décision et accepter cette sollicitation tant que la campagne n'est pas clôturée (${endsLabel}). ${rewardStr} € vous attendent.`,
    `Pour reprendre la main : ${RELATIONS_URL}`,
    "",
    "Vous pouvez nous aider à comprendre la raison de votre refus en cliquant sur l'un des liens suivants :",
    ...FEEDBACK_REASONS.map((r) => `  • ${r.label} — ${feedbackUrl(r.key)}`),
    "",
    "Merci, ces retours nous aident vraiment à améliorer BUUPP.",
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFEF8;border-radius:18px;border:1px solid #EAE3D0;overflow:hidden;box-shadow:0 4px 24px -8px rgba(15,22,41,.08);">
<tr><td style="padding:0;">
  <!-- Bandeau header neutre/tendre : confettis + titre -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#F1F2F6 0%,#E8EAF1 50%,#DDE0EA 100%);background-color:#E8EAF1;">
    <tr><td style="padding:24px 32px 18px;position:relative;">
      <!-- Confettis -->
      <div style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#4596EC;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:10px;height:10px;background:#7C3AED;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #F59E0B;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;vertical-align:middle;"></div>
      <div style="margin-top:14px;">
        <div style="font-family:Georgia,serif;font-size:30px;font-weight:600;color:#0F1629;letter-spacing:-.01em;">BUUPP</div>
        <div style="font-size:11px;color:#6B7180;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;font-weight:600;">↩ Sollicitation refusée</div>
      </div>
    </td></tr>
    <!-- Zigzag d'accent -->
    <tr><td style="height:14px;background-image:linear-gradient(135deg,#FFFEF8 25%,transparent 25%,transparent 50%,#FFFEF8 50%,#FFFEF8 75%,transparent 75%);background-size:14px 14px;line-height:0;font-size:0;">&nbsp;</td></tr>
  </table>

<tr><td style="padding:24px 32px 8px;">
  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#0F1629;font-weight:500;">
    Oups, ${escapeHtml(greet)} 🤔
  </h1>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3A4150;">
    Cette campagne de <strong>${escapeHtml(proName)}</strong> ne semble pas vous avoir intéressé(e) —
    pas de souci, on respecte votre choix.
  </p>

  <!-- Bloc "vous pouvez encore changer d'avis" : carte accent doux -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;border-collapse:separate;">
    <tr>
      <td style="padding:18px 20px;background:#FAF6E8;border:1px solid #EAE3D0;border-left:4px solid #4596EC;border-radius:14px;position:relative;">
        <div style="font-size:11px;color:#4596EC;text-transform:uppercase;letter-spacing:.14em;font-weight:600;">↺ Vous pouvez encore changer d'avis</div>
        <p style="margin:8px 0 12px;font-size:14.5px;line-height:1.55;color:#0F1629;">
          Tant que la campagne n'est pas clôturée (<strong>${escapeHtml(endsLabel)}</strong>), vous pouvez revenir sur votre
          décision et accepter pour empocher vos <strong>${rewardStr} €</strong>.
        </p>
        <p style="margin:0;text-align:center;">
          <a href="${RELATIONS_URL}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;padding:11px 24px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 100%);color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;box-shadow:0 4px 14px -4px rgba(69,150,236,.55);">
            Reprendre la main →
          </a>
        </p>
      </td>
    </tr>
  </table>

  <p style="margin:18px 0 10px;font-size:14px;line-height:1.55;color:#3A4150;">
    En quelques secondes — pouvez-vous nous aider à comprendre la raison de votre refus ?
    Cela nous aide à améliorer BUUPP.
  </p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      ${FEEDBACK_REASONS.map((r) => `
      <td style="padding:4px;" align="center">
        <a href="${feedbackUrl(r.key)}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;padding:11px 14px;background:#FFFEF8;color:#0F1629;text-decoration:none;border:1px solid #EAE3D0;border-radius:10px;font-weight:500;font-size:13px;line-height:1.2;width:90%;text-align:center;">
          ${escapeHtml(r.label)}
        </a>
      </td>`).join("")}
    </tr>
  </table>
  <!-- Petite ligne pointillée décorative -->
  <div style="text-align:center;margin:14px 0 4px;font-size:10px;letter-spacing:.6em;color:#C9D2E0;">● ● ● ● ●</div>
  <p style="margin:0;font-size:11.5px;color:#6B7180;text-align:center;">
    Un seul clic — votre choix nous parvient anonymement.
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
      `[email/relation-refused] mail envoyé à ${email} — messageId=${info.messageId}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[email/relation-refused] échec d'envoi à ${email} → ${msg}`);
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
