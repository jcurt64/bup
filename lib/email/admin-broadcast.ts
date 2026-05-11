/**
 * Mail envoyé à tous les destinataires d'un broadcast admin.
 *
 * Appelé en fire-and-forget depuis `POST /api/admin/broadcasts` : on boucle
 * sur les destinataires en `safeSendMail` pour avaler les bounces individuels
 * sans bloquer la création du broadcast.
 *
 * Le rendu HTML s'aligne sur `lib/email/relation.ts` (mail de sollicitation) :
 * bandeau décoré "confettis", carte ivoire arrondie, encart sectionné pour
 * le corps du message, bouton CTA gradient bleu→violet, footer logo. La
 * pièce jointe — si présente — apparaît dans une carte dédiée juste sous
 * le corps, avec une icône trombone.
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;

export type BroadcastEmailRecipient = {
  email: string;
  role: "prospect" | "pro";
};

export type SendBroadcastParams = {
  broadcastId: string;
  title: string;
  body: string;
  hasAttachment: boolean;
  attachmentFilename: string | null;
  recipients: BroadcastEmailRecipient[];
};

export async function sendBroadcastEmails(params: SendBroadcastParams): Promise<{
  attempted: number;
  failed: number;
}> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email/admin-broadcast] transport indisponible — envoi sauté");
    return { attempted: 0, failed: 0 };
  }

  const { broadcastId, title, body, hasAttachment, attachmentFilename, recipients } = params;

  const subject = `BUUPP — ${title}`;
  let failed = 0;

  for (const r of recipients) {
    const dashUrl = `${APP_URL}/${r.role}`;
    const attachmentUrl = hasAttachment
      ? `${APP_URL}/api/me/notifications/${encodeURIComponent(broadcastId)}/attachment`
      : null;

    const text = [
      `Bonjour,`,
      "",
      title,
      "─".repeat(Math.min(title.length, 40)),
      "",
      body,
      "",
      attachmentUrl
        ? `Pièce jointe (${attachmentFilename ?? "fichier"}) : ${attachmentUrl}`
        : null,
      "",
      `Retrouvez ce message dans votre espace : ${dashUrl}`,
      "",
      "— L'équipe BUUPP",
    ]
      .filter((l) => l !== null)
      .join("\n");

    const html = renderHtml({
      title,
      body,
      dashUrl,
      attachmentUrl,
      attachmentFilename,
    });

    try {
      await transport.sendMail({
        from: getFromAddress(),
        to: r.email,
        subject,
        text,
        html,
      });
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error(`[email/admin-broadcast] échec à ${r.email} → ${msg}`);
    }
  }

  console.log(
    `[email/admin-broadcast] broadcast=${broadcastId} attempted=${recipients.length} failed=${failed}`,
  );
  return { attempted: recipients.length, failed };
}

function renderHtml(params: {
  title: string;
  body: string;
  dashUrl: string;
  attachmentUrl: string | null;
  attachmentFilename: string | null;
}): string {
  const { title, body, dashUrl, attachmentUrl, attachmentFilename } = params;
  return `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F7F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F1629;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F4EC;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFEF8;border-radius:18px;border:1px solid #EAE3D0;overflow:hidden;box-shadow:0 4px 24px -8px rgba(15,22,41,.08);">
<tr><td style="padding:0;">
  <!-- Bandeau header avec confettis : 3 cercles + 1 carré incliné + un triangle (aligné sur relation.ts) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#E8F0FE 0%,#F3EAFF 100%);background-color:#E8F0FE;">
    <tr><td style="padding:24px 32px 18px;position:relative;">
      <!-- Décor : confettis -->
      <div style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#4596EC;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:10px;height:10px;background:#7C3AED;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #F59E0B;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;vertical-align:middle;"></div>
      <div style="margin-top:14px;">
        <div style="font-family:Georgia,serif;font-size:30px;font-weight:600;color:#0F1629;letter-spacing:-.01em;">BUUPP</div>
        <div style="font-size:11px;color:#4596EC;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;font-weight:600;">📣 Message de l'équipe</div>
      </div>
    </td></tr>
    <!-- Zigzag d'accent -->
    <tr><td style="height:14px;background-image:linear-gradient(135deg,#FFFEF8 25%,transparent 25%,transparent 50%,#FFFEF8 50%,#FFFEF8 75%,transparent 75%);background-size:14px 14px;line-height:0;font-size:0;">&nbsp;</td></tr>
  </table>

<tr><td style="padding:24px 32px 8px;">
  <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;line-height:1.3;color:#0F1629;font-weight:500;">
    ${escapeHtml(title)}
  </h1>
  <p style="margin:0 0 4px;font-size:11px;color:#4596EC;letter-spacing:.12em;text-transform:uppercase;font-weight:600;">◆ Le mot de l'équipe</p>
  <div style="margin:0 0 22px;padding:16px 18px;background:#FAF6E8;border:1px solid #EAE3D0;border-left:4px solid #4596EC;border-radius:10px;font-size:14.5px;line-height:1.65;color:#0F1629;white-space:pre-line;">${escapeHtml(body)}</div>

  ${
    attachmentUrl
      ? `
  <!-- Carte pièce jointe (palette ivoire + bordure ambrée pour rappeler un trombone) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border-collapse:separate;">
    <tr>
      <td style="padding:14px 16px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;">
        <div style="font-size:11px;color:#B45309;text-transform:uppercase;letter-spacing:.12em;font-weight:600;margin-bottom:6px;">📎 Pièce jointe</div>
        <div style="font-size:13.5px;color:#0F1629;font-family:'JetBrains Mono',ui-monospace,monospace;word-break:break-all;margin-bottom:10px;">${escapeHtml(attachmentFilename ?? "fichier joint")}</div>
        <a href="${attachmentUrl}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;padding:9px 16px;background:#FFFEF8;color:#0F1629;text-decoration:none;border:1px solid #EAE3D0;border-radius:999px;font-size:12.5px;font-weight:600;">
          ⬇ Télécharger
        </a>
      </td>
    </tr>
  </table>`
      : ""
  }

  <!-- CTA principal : gradient bleu→violet, aligné sur relation.ts -->
  <p style="margin:0 0 14px;text-align:center;">
    <a href="${dashUrl}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:14px 32px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 100%);color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;box-shadow:0 4px 14px -4px rgba(69,150,236,.55);">
      Ouvrir mon espace →
    </a>
  </p>
  <!-- Petite ligne pointillée décorative -->
  <div style="text-align:center;margin:8px 0 4px;font-size:10px;letter-spacing:.6em;color:#C9D2E0;">● ● ● ● ●</div>
  <p style="margin:0;font-size:12px;color:#6B7180;text-align:center;line-height:1.5;">
    Ce message est aussi disponible dans la cloche de votre dashboard.
  </p>
</td></tr>

<!-- Footer avec triangles décoratifs (aligné sur relation.ts) -->
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
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
