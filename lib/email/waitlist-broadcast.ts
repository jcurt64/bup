/**
 * Mail broadcast envoyé aux inscrits de la LISTE D'ATTENTE (pré-lancement).
 *
 * Différent de lib/email/admin-broadcast.ts, qui cible des comptes
 * existants (prospect / pro) avec cloche in-app + pixel de mesure CNIL.
 * Ici les destinataires n'ont pas (encore) de compte BUUPP :
 *   • pas de cloche in-app ni de pixel de tracking (rien à rattacher) ;
 *   • CTA vers la création de compte plutôt que vers un dashboard ;
 *   • message personnalisé avec le prénom donné à l'inscription waitlist.
 *
 * Le rendu HTML s'aligne sur admin-broadcast.ts + waitlist-launched.ts :
 * bandeau « confettis », carte corps de message, carte pièce jointe
 * optionnelle, bouton CTA gradient bleu→violet, footer logo.
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const SIGNUP_URL = `${APP_URL}/inscription/prospect?from=waitlist-broadcast`;
const SUPPORT_EMAIL = "support@buupp.com";

export type WaitlistBroadcastRecipient = {
  email: string;
  prenom: string;
};

export type BroadcastVideo = {
  url?: string | null;
  thumbnailUrl?: string | null;
  label?: string | null;
};

/** Nombre maximum de vignettes vidéo rendues dans le mail. */
export const MAX_BROADCAST_VIDEOS = 2;

export type SendWaitlistBroadcastParams = {
  broadcastId: string;
  title: string;
  body: string;
  /** URL signée (Storage) de la pièce jointe, ou null. Les inscrits
   *  waitlist n'ayant pas de compte, on ne peut pas réutiliser la route
   *  authentifiée /api/me/notifications/[id]/attachment → on génère une
   *  URL signée publique côté API avant l'appel. */
  attachmentUrl: string | null;
  attachmentFilename: string | null;
  /** Blocs vidéo optionnels (2 max) : miniature cliquable (bouton play CSS)
   *  qui ouvre `url`. Une entrée n'est rendue que si `url` ET `thumbnailUrl`
   *  sont fournis ; `label` est la légende affichée sous la vignette. */
  videos?: BroadcastVideo[];
  /** CTA personnalisé optionnel. Si `ctaUrl` ET `ctaLabel` sont fournis, ils
   *  remplacent le bouton par défaut « Créer mon compte → » (vers l'inscription). */
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  recipients: WaitlistBroadcastRecipient[];
};

export async function sendWaitlistBroadcast(
  params: SendWaitlistBroadcastParams,
): Promise<{ attempted: number; failed: number }> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email/waitlist-broadcast] transport indisponible — envoi sauté");
    return { attempted: 0, failed: 0 };
  }

  const { broadcastId, title, body, attachmentUrl, attachmentFilename, recipients } = params;
  // Blocs vidéo : une entrée n'est retenue que si miniature + URL fournies.
  const videos = normalizeVideos(params.videos);
  // CTA personnalisé : actif seulement si label + URL fournis, sinon défaut.
  const ctaLabel = params.ctaLabel?.trim() || null;
  const ctaUrl = params.ctaUrl?.trim() || null;
  const hasCustomCta = Boolean(ctaLabel && ctaUrl);
  const ctaHref = hasCustomCta ? (ctaUrl as string) : SIGNUP_URL;
  const ctaText = hasCustomCta ? (ctaLabel as string) : "Créer mon compte →";

  const subject = `BUUPP — ${title}`;
  let failed = 0;

  for (const r of recipients) {
    const prenom = r.prenom?.trim() || "à vous";

    const text = [
      `Bonjour ${prenom},`,
      "",
      title,
      "─".repeat(Math.min(title.length, 40)),
      "",
      body,
      "",
      ...videos.map((v) => `${v.label ? `${v.label} — ` : "Voir la vidéo : "}${v.url}`),
      attachmentUrl
        ? `Pièce jointe (${attachmentFilename ?? "fichier"}) : ${attachmentUrl}`
        : null,
      "",
      `${ctaText.replace(/\s*→\s*$/, "")} : ${ctaHref}`,
      "",
      "— L'équipe BUUPP",
      "",
      "—",
      "Vous recevez ce message car vous êtes inscrit·e sur la liste d'attente BUUPP.",
      `Pour ne plus recevoir nos emails, écrivez-nous à ${SUPPORT_EMAIL}.`,
    ]
      .filter((l) => l !== null)
      .join("\n");

    const html = renderHtml({
      title,
      body,
      prenom,
      attachmentUrl,
      attachmentFilename,
      videos,
      ctaHref,
      ctaText,
      hasCustomCta,
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
      console.error(`[email/waitlist-broadcast] échec à ${r.email} → ${msg}`);
    }
  }

  console.log(
    `[email/waitlist-broadcast] broadcast=${broadcastId} attempted=${recipients.length} failed=${failed}`,
  );
  return { attempted: recipients.length, failed };
}

/**
 * Rendu HTML du mail — exporté pour l'aperçu et les tests (l'envoi passe
 * toujours par sendWaitlistBroadcast).
 */
export function renderWaitlistBroadcastHtml(params: {
  title: string;
  body: string;
  prenom: string;
  attachmentUrl?: string | null;
  attachmentFilename?: string | null;
  videos?: BroadcastVideo[];
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): string {
  const videos = normalizeVideos(params.videos);
  const ctaLabel = params.ctaLabel?.trim() || null;
  const ctaUrl = params.ctaUrl?.trim() || null;
  const hasCustomCta = Boolean(ctaLabel && ctaUrl);
  return renderHtml({
    title: params.title,
    body: params.body,
    prenom: params.prenom,
    attachmentUrl: params.attachmentUrl ?? null,
    attachmentFilename: params.attachmentFilename ?? null,
    videos,
    ctaHref: hasCustomCta ? (ctaUrl as string) : SIGNUP_URL,
    ctaText: hasCustomCta ? (ctaLabel as string) : "Créer mon compte →",
    hasCustomCta,
  });
}

/** Ne garde que les blocs vidéo exploitables (url + miniature), 2 max. */
function normalizeVideos(
  videos: BroadcastVideo[] | undefined,
): { url: string; thumbnailUrl: string; label: string | null }[] {
  return (videos ?? [])
    .map((v) => ({
      url: v.url?.trim() || null,
      thumbnailUrl: v.thumbnailUrl?.trim() || null,
      label: v.label?.trim() || null,
    }))
    .filter((v): v is { url: string; thumbnailUrl: string; label: string | null } =>
      Boolean(v.url && v.thumbnailUrl),
    )
    .slice(0, MAX_BROADCAST_VIDEOS);
}

function renderHtml(params: {
  title: string;
  body: string;
  prenom: string;
  attachmentUrl: string | null;
  attachmentFilename: string | null;
  videos: { url: string; thumbnailUrl: string; label: string | null }[];
  ctaHref: string;
  ctaText: string;
  hasCustomCta: boolean;
}): string {
  const {
    title, body, prenom, attachmentUrl, attachmentFilename,
    videos, ctaHref, ctaText, hasCustomCta,
  } = params;
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
  <!-- Bandeau header avec confettis (aligné sur admin-broadcast.ts) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#E8F0FE 0%,#F3EAFF 100%);background-color:#E8F0FE;">
    <tr><td style="padding:24px 32px 18px;position:relative;">
      <div style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#4596EC;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:10px;height:10px;background:#7C3AED;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #F59E0B;margin-right:10px;vertical-align:middle;"></div>
      <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;vertical-align:middle;"></div>
      <div style="margin-top:14px;">
        <div style="font-family:Georgia,serif;font-size:30px;font-weight:600;color:#0F1629;letter-spacing:-.01em;">BUUPP</div>
        <div style="font-size:11px;color:#4596EC;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;font-weight:600;">📣 Message de l'équipe</div>
      </div>
    </td></tr>
    <tr><td style="height:14px;background-image:linear-gradient(135deg,#FFFEF8 25%,transparent 25%,transparent 50%,#FFFEF8 50%,#FFFEF8 75%,transparent 75%);background-size:14px 14px;line-height:0;font-size:0;">&nbsp;</td></tr>
  </table>

<tr><td style="padding:24px 32px 8px;">
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3A4150;">Bonjour ${escapeHtml(prenom)},</p>
  <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;line-height:1.3;color:#0F1629;font-weight:500;">
    ${escapeHtml(title)}
  </h1>
  <p style="margin:0 0 4px;font-size:11px;color:#4596EC;letter-spacing:.12em;text-transform:uppercase;font-weight:600;">◆ Le mot de l'équipe</p>
  <div style="margin:0 0 22px;padding:16px 18px;background:#FAF6E8;border:1px solid #EAE3D0;border-left:4px solid #4596EC;border-radius:10px;font-size:14.5px;line-height:1.65;color:#0F1629;white-space:pre-line;">${escapeHtml(body)}</div>

  ${
    attachmentUrl
      ? `
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

  ${
    videos.length > 0
      ? `
  <p style="margin:0 0 10px;font-size:11px;color:#4596EC;letter-spacing:.12em;text-transform:uppercase;font-weight:600;">
    ▶ ${videos.length > 1 ? "En vidéo" : "La vidéo"}
  </p>
  ${videos.map((v, i) => renderVideoBlock(v, i, videos.length)).join("")}`
      : ""
  }

  <!-- CTA principal : gradient bleu→violet (création de compte par défaut, ou CTA personnalisé) -->
  <p style="margin:0 0 14px;text-align:center;">
    <a href="${ctaHref}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:14px 32px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 100%);color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;box-shadow:0 4px 14px -4px rgba(69,150,236,.55);">
      ${escapeHtml(ctaText)}
    </a>
  </p>
  <div style="text-align:center;margin:8px 0 4px;font-size:10px;letter-spacing:.6em;color:#C9D2E0;">● ● ● ● ●</div>
  ${
    hasCustomCta
      ? ""
      : `<p style="margin:0;font-size:12px;color:#6B7180;text-align:center;line-height:1.5;">
    Inscription en 2 minutes, sans engagement.
  </p>`
  }
</td></tr>

<!-- Footer avec triangles décoratifs (aligné sur admin-broadcast.ts) -->
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
  <p style="margin:10px 0 0;font-size:10px;color:#9CA3AF;line-height:1.55;">
    Vous recevez ce message car vous êtes inscrit·e sur la liste d'attente BUUPP.
    Pour ne plus recevoir nos emails, écrivez-nous à
    <a href="mailto:${SUPPORT_EMAIL}" style="color:#9CA3AF;text-decoration:underline;">${SUPPORT_EMAIL}</a>.
  </p>
</td></tr>
</td></tr>
</table>
</td></tr></table>
</body></html>
  `.trim();
}

/**
 * Une vignette vidéo : image de fond cliquable + bouton play dessiné en CSS
 * (pas d'image hébergée à charger), légende dessous. Repli Outlook / images
 * bloquées : cadre sombre `bgcolor` avec le bouton play centré, toujours
 * cliquable. La hauteur est réduite quand il y a deux vidéos pour que le
 * bloc reste au-dessus de la ligne de flottaison.
 */
function renderVideoBlock(
  video: { url: string; thumbnailUrl: string; label: string | null },
  index: number,
  total: number,
): string {
  const height = total > 1 ? 220 : 280;
  const numbered = total > 1 ? `${index + 1}. ` : "";
  const caption = video.label
    ? `${numbered}${video.label}`
    : `${numbered}Voir la vidéo`;
  return `
  <a href="${video.url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:block;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;border-collapse:separate;">
      <tr>
        <td background="${video.thumbnailUrl}" bgcolor="#0F1629" valign="middle" align="center" height="${height}"
            style="background-image:url('${video.thumbnailUrl}');background-position:center;background-size:cover;background-repeat:no-repeat;border-radius:14px;height:${height}px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
            <td align="center" valign="middle" style="width:66px;height:66px;background:#FFFEF8;border-radius:50%;box-shadow:0 6px 18px -4px rgba(15,22,41,.5);">
              <div style="display:inline-block;width:0;height:0;border-top:12px solid transparent;border-bottom:12px solid transparent;border-left:19px solid #4596EC;margin-left:5px;"></div>
            </td>
          </tr></table>
        </td>
      </tr>
    </table>
  </a>
  <p style="margin:0 0 ${index === total - 1 ? 22 : 18}px;text-align:center;font-size:12.5px;color:#3A4150;font-weight:600;">
    ${escapeHtml(caption)}
  </p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
