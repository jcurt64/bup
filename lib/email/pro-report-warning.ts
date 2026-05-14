/**
 * Mail envoyé au pro suite à un signalement enregistré contre lui par un
 * prospect. Ton chaleureux et non-accusatoire — on ouvre le dialogue
 * plutôt qu'on impose une sanction. Trois motifs possibles :
 *   - sollicitation_multiple : > 1 sollicitation sur la même campagne
 *   - faux_compte            : doute sur la légitimité de la société
 *   - echange_abusif         : ressenti négatif sur l'attitude du pro
 *
 * Déclenché depuis le back-office (/buupp-admin/signalements) via
 *   POST /api/admin/reports/[id]/notify-pro
 *
 * Fire-and-forget côté handler ; ici on log les succès / échecs sans
 * relancer (pas de blocage admin si SMTP est down).
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const PRO_URL = `${APP_URL}/pro`;

export type ProReportWarningReason =
  | "sollicitation_multiple"
  | "faux_compte"
  | "echange_abusif";

export type ProReportWarningParams = {
  email: string;
  proName: string;
  reason: ProReportWarningReason;
  campaignName: string | null;
  sentAt: string | null;
};

const REASON_META: Record<
  ProReportWarningReason,
  { label: string; eyebrow: string; intro: string }
> = {
  sollicitation_multiple: {
    label: "Sollicitation multiple",
    eyebrow: "✉ Un point sur vos sollicitations",
    intro:
      "un membre nous a indiqué avoir reçu plusieurs sollicitations de votre part sur la même campagne. On voulait simplement vous prévenir, car le règlement BUUPP prévoit une seule prise de contact par prospect.",
  },
  faux_compte: {
    label: "Doute sur le compte",
    eyebrow: "✉ Un point sur votre compte",
    intro:
      "un membre nous a fait remonter un doute sur la légitimité de votre compte. Rien d'alarmant à ce stade — on préfère vous en parler pour clarifier ensemble.",
  },
  echange_abusif: {
    label: "Retour sur un échange",
    eyebrow: "✉ Un retour reçu sur l'un de vos échanges",
    intro:
      "un membre nous a partagé un ressenti négatif après un échange avec vous. On préfère vous en parler directement plutôt que de tirer des conclusions à votre place.",
  },
};

/**
 * Compose le contenu du mail (subject + text + html) sans envoyer. Utilisé
 * par le handler de send ET par le handler de preview pour garantir que
 * l'aperçu admin == ce qui sera réellement envoyé.
 */
export function buildProReportWarningContent(
  params: Omit<ProReportWarningParams, "email">,
): { subject: string; text: string; html: string } {
  const { proName, reason, campaignName, sentAt } = params;
  const meta = REASON_META[reason];
  const sentAtLabel = formatDate(sentAt);
  const campaignLabel = (campaignName ?? "").trim() || "—";

  const subject = "Petit point sur l'une de vos sollicitations BUUPP";

  const text = [
    `Bonjour ${proName},`,
    "",
    `Ici l'équipe BUUPP — ${meta.intro}`,
    "",
    "Pour le contexte :",
    `  • Campagne : ${campaignLabel}`,
    `  • Sollicitation envoyée le : ${sentAtLabel}`,
    `  • Type de retour reçu : ${meta.label}`,
    "",
    "On ne tire évidemment aucune conclusion à votre place : il arrive qu'un membre nous remonte quelque chose de très ponctuel, parfois mal interprété. C'est précisément pour ça qu'on prend contact avec vous avant tout.",
    "",
    "Si vous voulez nous donner votre version, ou si vous avez besoin d'éclaircissements de notre côté, répondez simplement à ce mail — on lit tout.",
    "",
    `Vous pouvez aussi retrouver votre espace pro ici : ${PRO_URL}`,
    "",
    "Merci pour votre attention, et continuez de faire vivre la communauté BUUPP.",
    "",
    "Chaleureusement,",
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
  <!-- Bandeau header neutre/doux : confettis + titre BUUPP -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#F1F2F6 0%,#E8EAF1 50%,#DDE0EA 100%);background-color:#E8EAF1;">
    <tr><td style="padding:24px 32px 18px;position:relative;">
      <div style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#4596EC;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:10px;height:10px;background:#7C3AED;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #F59E0B;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;vertical-align:middle;"></div>
      <div style="margin-top:14px;">
        <div style="font-family:Georgia,serif;font-size:30px;font-weight:600;color:#0F1629;letter-spacing:-.01em;">BUUPP</div>
        <div style="font-size:11px;color:#6B7180;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;font-weight:600;">${escapeHtml(meta.eyebrow)}</div>
      </div>
    </td></tr>
    <tr><td style="height:14px;background-image:linear-gradient(135deg,#FFFEF8 25%,transparent 25%,transparent 50%,#FFFEF8 50%,#FFFEF8 75%,transparent 75%);background-size:14px 14px;line-height:0;font-size:0;">&nbsp;</td></tr>
  </table>

<tr><td style="padding:24px 32px 8px;">
  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:#0F1629;font-weight:500;">
    Bonjour ${escapeHtml(proName)} 👋
  </h1>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3A4150;">
    Ici l'équipe BUUPP — ${escapeHtml(meta.intro)}
  </p>

  <!-- Bloc contexte : ton neutre, juste les faits -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;border-collapse:separate;">
    <tr>
      <td style="padding:16px 18px;background:#FAF6E8;border:1px solid #EAE3D0;border-left:4px solid #4596EC;border-radius:14px;">
        <div style="font-size:11px;color:#4596EC;text-transform:uppercase;letter-spacing:.14em;font-weight:600;margin-bottom:10px;">Pour le contexte</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:13.5px;line-height:1.6;color:#0F1629;">
          <tr>
            <td style="padding:2px 0;color:#6B7180;width:48%;">Campagne</td>
            <td style="padding:2px 0;font-weight:500;">${escapeHtml(campaignLabel)}</td>
          </tr>
          <tr>
            <td style="padding:2px 0;color:#6B7180;">Sollicitation envoyée le</td>
            <td style="padding:2px 0;font-weight:500;">${escapeHtml(sentAtLabel)}</td>
          </tr>
          <tr>
            <td style="padding:2px 0;color:#6B7180;">Type de retour reçu</td>
            <td style="padding:2px 0;font-weight:500;">${escapeHtml(meta.label)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 14px;font-size:14.5px;line-height:1.6;color:#3A4150;">
    On ne tire évidemment aucune conclusion à votre place : il arrive qu'un membre nous
    remonte quelque chose de très ponctuel, parfois mal interprété. C'est précisément
    pour ça qu'on prend contact avec vous avant tout.
  </p>

  <p style="margin:0 0 14px;font-size:14.5px;line-height:1.6;color:#3A4150;">
    Si vous voulez nous donner votre version, ou si vous avez besoin d'éclaircissements
    de notre côté, <strong>répondez simplement à ce mail</strong> — on lit tout.
  </p>

  <p style="margin:18px 0 8px;text-align:center;">
    <a href="${PRO_URL}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:11px 24px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 100%);color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;box-shadow:0 4px 14px -4px rgba(69,150,236,.55);">
      Mon espace pro →
    </a>
  </p>

  <p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#6B7180;text-align:center;">
    Merci pour votre attention, et continuez de faire vivre la communauté BUUPP.
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
    BUUPP — Be Used, Paid &amp; Proud · Chaleureusement, l'équipe BUUPP.
  </p>
</td></tr>
</td></tr>
</table>
</td></tr></table>
</body></html>
  `.trim();

  return { subject, text, html };
}

/**
 * Envoie effectivement le mail via le transport SMTP configuré.
 * S'appuie sur buildProReportWarningContent pour garantir parité avec
 * l'aperçu admin.
 */
export async function sendProReportWarning(
  params: ProReportWarningParams,
): Promise<{ ok: boolean; messageId: string | null }> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email/pro-report-warning] transport absent — skip");
    return { ok: false, messageId: null };
  }

  const { email, reason } = params;
  const { subject, text, html } = buildProReportWarningContent(params);

  try {
    const info = await transport.sendMail({
      from: getFromAddress(),
      to: email,
      subject,
      text,
      html,
    });
    console.log(
      `[email/pro-report-warning] mail envoyé à ${email} (motif=${reason}) — messageId=${info.messageId}`,
    );
    return { ok: true, messageId: info.messageId ?? null };
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[email/pro-report-warning] échec d'envoi à ${email} → ${msg}`);
    return { ok: false, messageId: null };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
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
