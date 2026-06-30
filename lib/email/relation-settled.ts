/**
 * Mail envoyé au prospect quand sa récompense passe de "séquestre" à
 * "disponible" (settle automatique 3 minutes après le lancement de la
 * campagne — RPC `settle_ripe_relations`, helper `lib/settle/ripe.ts`).
 *
 * Fire-and-forget : appelé en `Promise.allSettled` non-await — un échec
 * SMTP ne fait jamais échouer la requête API qui a déclenché le settle.
 *
 * Calqué sur le mail d'invitation (lib/email/relation.ts) pour conserver
 * une charte cohérente : entête BUUPP, carte récompense ink, CTA accent.
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const LINK_URL = `${APP_URL}/prospect?tab=portefeuille`;

export type RelationSettledParams = {
  email: string;
  prenom: string | null;
  proName: string;
  rewardEur: number;
  /** Identifiant unique de la mise en relation (relation_id). Sert de
   *  numéro d'authentification : on en affiche les 4 derniers caractères
   *  au prospect pour qu'il vérifie l'identité du pro qui le sollicite. */
  relationId: string;
};

/** Numéro d'authentification lisible dérivé du relation_id : caractères
 *  alphanumériques, en majuscules (les tirets de l'UUID sont retirés). */
function authCodeFromRelationId(relationId: string): string {
  return (relationId || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export async function sendRelationSettled(
  params: RelationSettledParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const { email, prenom, proName, rewardEur, relationId } = params;
  const greet = prenom?.trim() || "Bonjour";
  const rewardStr = rewardEur.toFixed(2).replace(".", ",");
  const authFull = authCodeFromRelationId(relationId);
  const authLast4 = authFull.slice(-4) || "????";
  const subject = `Vos ${rewardStr} € sont disponibles ✓`;

  const text = [
    `Bonjour ${greet},`,
    "",
    `La campagne dont vous avez accepté la sollicitation est arrivée à son terme : vous empochez ${rewardStr} €, désormais crédités sur votre solde disponible. Cette somme n'est plus sous séquestre.`,
    "",
    `À compter de maintenant, ${proName} peut vous solliciter directement. Pour s'authentifier, le professionnel vous communiquera son numéro d'authentification unique, dont les 4 derniers caractères sont : ${authLast4}. Vérifiez qu'ils correspondent avant de lui répondre.`,
    "",
    "Vous pouvez consulter votre solde ou demander un retrait depuis votre portefeuille :",
    LINK_URL,
    "",
    "À bientôt,",
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
  <!-- Bandeau header doré : gros trophée + confettis -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,#FFF4D6 0%,#FFE9B5 50%,#FFD980 100%);background-color:#FFE9B5;">
    <tr><td style="padding:28px 32px 22px;text-align:center;position:relative;">
      <!-- Confettis : cercle bleu, carré violet, triangle ambre, cercle vert -->
      <div style="margin-bottom:6px;line-height:0;font-size:0;">
        <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#4596EC;margin:0 6px;vertical-align:middle;"></span>
        <span style="display:inline-block;width:10px;height:10px;background:#7C3AED;transform:rotate(45deg);margin:0 6px;vertical-align:middle;"></span>
        <span style="display:inline-block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid #F59E0B;margin:0 6px;vertical-align:middle;"></span>
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;margin:0 6px;vertical-align:middle;"></span>
      </div>
      <!-- Gros trophée -->
      <div style="font-size:72px;line-height:1;margin:6px 0 8px;">🏆</div>
      <div style="font-family:Georgia,serif;font-size:30px;font-weight:600;color:#0F1629;letter-spacing:-.01em;">BUUPP</div>
      <div style="font-size:11px;color:#B45309;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;font-weight:600;">✨ Récompense encaissée</div>
    </td></tr>
    <!-- Zigzag d'accent -->
    <tr><td style="height:14px;background-image:linear-gradient(135deg,#FFFEF8 25%,transparent 25%,transparent 50%,#FFFEF8 50%,#FFFEF8 75%,transparent 75%);background-size:14px 14px;line-height:0;font-size:0;">&nbsp;</td></tr>
  </table>

<tr><td style="padding:24px 32px 8px;">
  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;line-height:1.3;color:#0F1629;font-weight:500;">
    ${escapeHtml(greet)}, vos ${rewardStr} € sont à vous 🎉
  </h1>
  <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3A4150;">
    La campagne dont vous avez accepté la sollicitation est arrivée à son
    terme : vous empochez <strong>${rewardStr} €</strong>, désormais crédités
    sur votre <strong>solde disponible</strong>. Cette somme n'est plus sous séquestre.
  </p>

  <!-- Bloc récompense : gradient or → ambre + cercles décoratifs -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;border-collapse:separate;">
    <tr>
      <td style="padding:18px 20px;background:#F59E0B;background-image:linear-gradient(135deg,#F59E0B 0%,#D97706 60%,#B45309 100%);border-radius:14px;color:#FFFEF8;position:relative;">
        <!-- Cercles décoratifs -->
        <div style="position:absolute;top:-10px;right:14px;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.20);"></div>
        <div style="position:absolute;bottom:-8px;right:46px;width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,0.12);"></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.90);text-transform:uppercase;letter-spacing:.14em;font-weight:600;">💰 Crédité sur votre portefeuille</div>
        <div style="font-family:Georgia,serif;font-size:36px;font-weight:600;line-height:1.1;margin-top:6px;letter-spacing:-.01em;">${rewardStr} €</div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.30);font-size:12px;color:rgba(255,255,255,0.95);">Statut : <strong style="color:#FFFEF8;">Disponible</strong> — retirable selon le seuil en vigueur.</div>
      </td>
    </tr>
  </table>

  <!-- Bloc authentification : le pro pourra solliciter le prospect et devra
       citer son numéro d'authentification unique, dont on rappelle les 4
       derniers caractères pour vérification. -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;border-collapse:separate;">
    <tr>
      <td style="padding:16px 18px;background:#FFFEF8;border:1px solid #EAE3D0;border-radius:14px;">
        <div style="font-size:11px;color:#6B7180;text-transform:uppercase;letter-spacing:.12em;font-weight:600;margin-bottom:8px;">🔐 Authentification du professionnel</div>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3A4150;">
          À compter de maintenant, <strong>${escapeHtml(proName)}</strong> peut vous
          solliciter directement. Pour s'authentifier, le professionnel vous
          communiquera son <strong>numéro d'authentification unique</strong>.
          Vérifiez que ses 4 derniers caractères correspondent à&nbsp;:
        </p>
        <div style="text-align:center;padding:12px 10px;background:#0F1629;border-radius:10px;">
          <span style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:26px;font-weight:700;letter-spacing:.32em;color:#FFFEF8;">${escapeHtml(authLast4)}</span>
        </div>
        <p style="margin:10px 0 0;font-size:12px;color:#6B7180;line-height:1.5;">
          Ne répondez qu'à un professionnel dont le numéro se termine par ces 4&nbsp;caractères.
        </p>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 14px;text-align:center;">
    <a href="${LINK_URL}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:14px 32px;background:#4596EC;background-image:linear-gradient(135deg,#4596EC 0%,#6D5BFF 100%);color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;box-shadow:0 4px 14px -4px rgba(69,150,236,.55);">
      Voir mon portefeuille →
    </a>
  </p>
  <!-- Petite ligne pointillée décorative -->
  <div style="text-align:center;margin:8px 0 4px;font-size:10px;letter-spacing:.6em;color:#C9D2E0;">● ● ● ● ●</div>
  <p style="margin:0;font-size:12px;color:#6B7180;text-align:center;line-height:1.5;">
    Merci d'avoir accepté cette mise en relation. Plus vous participez, plus vous gagnez.
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
      `[email/relation-settled] mail envoyé à ${email} — messageId=${info.messageId}` +
        (info.accepted?.length ? ` accepted=[${info.accepted.join(", ")}]` : "") +
        (info.rejected?.length ? ` rejected=[${info.rejected.join(", ")}]` : ""),
    );
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[email/relation-settled] échec d'envoi à ${email} → ${msg}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
