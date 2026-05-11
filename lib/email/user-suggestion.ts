/**
 * Mail interne envoyé à l'équipe BUUPP quand un utilisateur soumet une
 * suggestion depuis son dashboard. Destinataire = `BUUPP_SUGGESTIONS_INBOX`
 * (env), fallback `jjlex64@gmail.com`.
 *
 * Template HTML aligné sur `lib/email/relation.ts` (bandeau décoré, carte
 * ivoire, encart corps en pre-line). Le `replyTo` est mis sur l'email de
 * l'utilisateur → un clic « Répondre » dans Gmail envoie directement à la
 * bonne personne sans copier-coller manuel.
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;

export type SuggestionParams = {
  /** Email primaire de l'utilisateur côté Clerk. */
  fromEmail: string | null;
  /** Nom complet (ou raison sociale pour un pro), depuis /api/me logic. */
  fromName: string | null;
  /** Rôle DB de l'utilisateur — sert juste à teaser dans l'eyebrow. */
  fromRole: "prospect" | "pro" | null;
  /** Sujet libre (peut être null si l'utilisateur n'en a pas mis). */
  subject: string | null;
  /** Corps du message (déjà trimé côté API). */
  message: string;
};

export async function sendUserSuggestion(params: SuggestionParams): Promise<{
  ok: boolean;
}> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email/user-suggestion] transport indisponible — suggestion ignorée");
    return { ok: false };
  }

  const inbox = process.env.BUUPP_SUGGESTIONS_INBOX || "jjlex64@gmail.com";
  const { fromEmail, fromName, fromRole, subject, message } = params;

  const displayFrom = fromName ?? fromEmail ?? "Utilisateur anonyme";
  const subjectLine = subject?.trim()
    ? `[BUUPP] Suggestion — ${subject}`
    : `[BUUPP] Suggestion d'un ${fromRole === "pro" ? "pro" : "prospect"}`;

  const text = [
    `De : ${displayFrom}${fromEmail ? ` <${fromEmail}>` : ""}${fromRole ? ` (${fromRole})` : ""}`,
    subject ? `Sujet : ${subject}` : null,
    "",
    message,
    "",
    "—",
    "Envoyé depuis le dashboard BUUPP (onglet « Vos suggestions »).",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = renderHtml({
    displayFrom,
    fromEmail,
    fromRole,
    subject,
    message,
  });

  try {
    await transport.sendMail({
      from: getFromAddress(),
      to: inbox,
      replyTo: fromEmail ?? undefined,
      subject: subjectLine,
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[email/user-suggestion] échec d'envoi → ${msg}`);
    return { ok: false };
  }
}

function renderHtml(params: {
  displayFrom: string;
  fromEmail: string | null;
  fromRole: "prospect" | "pro" | null;
  subject: string | null;
  message: string;
}): string {
  const { displayFrom, fromEmail, fromRole, subject, message } = params;
  const eyebrow =
    fromRole === "pro"
      ? "Suggestion d'un pro"
      : fromRole === "prospect"
        ? "Suggestion d'un prospect"
        : "Suggestion utilisateur";
  return `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(eyebrow)}</title></head>
<body style="margin:0;padding:0;background:#F7F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F1629;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F4EC;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFEF8;border-radius:18px;border:1px solid #EAE3D0;overflow:hidden;box-shadow:0 4px 24px -8px rgba(15,22,41,.08);">
<tr><td style="padding:0;">
  <!-- Bandeau header confettis (aligné sur relation.ts) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#E8F0FE 0%,#F3EAFF 100%);background-color:#E8F0FE;">
    <tr><td style="padding:24px 32px 18px;position:relative;">
      <div style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#4596EC;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:10px;height:10px;background:#7C3AED;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #F59E0B;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;vertical-align:middle;"></div>
      <div style="margin-top:14px;">
        <div style="font-family:Georgia,serif;font-size:30px;font-weight:600;color:#0F1629;letter-spacing:-.01em;">BUUPP</div>
        <div style="font-size:11px;color:#4596EC;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;font-weight:600;">💡 ${escapeHtml(eyebrow)}</div>
      </div>
    </td></tr>
    <tr><td style="height:14px;background-image:linear-gradient(135deg,#FFFEF8 25%,transparent 25%,transparent 50%,#FFFEF8 50%,#FFFEF8 75%,transparent 75%);background-size:14px 14px;line-height:0;font-size:0;">&nbsp;</td></tr>
  </table>

<tr><td style="padding:24px 32px 8px;">
  <!-- Bloc émetteur -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;border-collapse:separate;">
    <tr>
      <td style="padding:14px 18px;background:#FAF6E8;border:1px solid #EAE3D0;border-radius:12px;">
        <div style="font-size:11px;color:#4596EC;text-transform:uppercase;letter-spacing:.14em;font-weight:600;margin-bottom:6px;">◆ De la part de</div>
        <div style="font-size:15px;color:#0F1629;font-weight:500;">${escapeHtml(displayFrom)}</div>
        ${
          fromEmail
            ? `<div style="font-size:12px;color:#6B7180;font-family:'JetBrains Mono',ui-monospace,monospace;margin-top:2px;">${escapeHtml(fromEmail)}</div>`
            : ""
        }
        ${
          fromRole
            ? `<div style="display:inline-block;margin-top:8px;padding:2px 8px;background:#FFFEF8;border:1px solid #EAE3D0;border-radius:999px;font-size:10px;color:#3A4150;letter-spacing:.06em;text-transform:uppercase;font-weight:600;">${escapeHtml(fromRole)}</div>`
            : ""
        }
      </td>
    </tr>
  </table>

  ${
    subject
      ? `
  <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;line-height:1.3;color:#0F1629;font-weight:500;">
    ${escapeHtml(subject)}
  </h1>`
      : ""
  }
  <p style="margin:0 0 4px;font-size:11px;color:#4596EC;letter-spacing:.12em;text-transform:uppercase;font-weight:600;">💬 Message</p>
  <div style="margin:0 0 22px;padding:16px 18px;background:#FFFEF8;border:1px solid #EAE3D0;border-left:4px solid #4596EC;border-radius:10px;font-size:14.5px;line-height:1.65;color:#0F1629;white-space:pre-line;">${escapeHtml(message)}</div>

  ${
    fromEmail
      ? `
  <p style="margin:0 0 14px;text-align:center;">
    <a href="mailto:${encodeURIComponent(fromEmail)}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:14px 32px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 100%);color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;box-shadow:0 4px 14px -4px rgba(69,150,236,.55);">
      Répondre par email →
    </a>
  </p>`
      : ""
  }
  <div style="text-align:center;margin:8px 0 4px;font-size:10px;letter-spacing:.6em;color:#C9D2E0;">● ● ● ● ●</div>
  <p style="margin:0;font-size:12px;color:#6B7180;text-align:center;line-height:1.5;">
    Le « Répondre » de votre client mail répond directement à ${fromEmail ? escapeHtml(fromEmail) : "l'expéditeur"}.
  </p>
</td></tr>

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
    Envoyé depuis l'onglet « Vos suggestions » d'un dashboard BUUPP.
  </p>
</td></tr>
</td></tr>
</table>
</td></tr></table>
</body></html>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
