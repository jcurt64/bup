/**
 * Mail envoyé à un FILLEUL lorsqu'une campagne avec « bonus parrain » sollicite
 * son parrain : le filleul est sollicité en plus (même hors cible). Distinct de
 * `sendRelationInvitation` (cible directe) — ici le message explique que la
 * sollicitation arrive via le parrain. Fire-and-forget (cf. relation.ts).
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const PROSPECT_BASE = `${APP_URL}/prospect?tab=relations`;

export type ReferralInvitationParams = {
  email: string;
  prenom: string | null;
  proName: string;
  rewardEur: number;
  expiresAt: string; // ISO
  relationId?: string | null;
};

export async function sendReferralInvitation(
  params: ReferralInvitationParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const { email, prenom, proName, rewardEur, expiresAt, relationId = null } = params;
  const greet = prenom?.trim() || "Bonjour";
  const linkUrl = relationId
    ? `${PROSPECT_BASE}&relationId=${encodeURIComponent(relationId)}`
    : PROSPECT_BASE;
  const rewardStr = rewardEur.toFixed(2).replace(".", ",");
  const deadline = new Date(expiresAt);
  const deadlineStr = isNaN(deadline.getTime())
    ? null
    : new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }).format(deadline);

  const subject = `${proName} : une sollicitation reçue par votre parrain pourrait aussi vous intéresser`;

  const text = [
    `${greet},`,
    "",
    `Votre parrain vient de recevoir une sollicitation de ${proName} sur BUUPP, et elle pourrait aussi vous intéresser.`,
    "",
    `En tant que filleul·e, vous pouvez l'accepter et toucher votre récompense de ${rewardStr} €.`,
    "Si votre profil n'est pas encore complet, renseignez vos informations pour pouvoir accepter.",
    deadlineStr ? `\nÀ accepter avant le ${deadlineStr}.` : "",
    "",
    `Voir la sollicitation : ${linkUrl}`,
    "",
    "— L'équipe BUUPP",
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0F172A;line-height:1.55;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <p>${greet},</p>
      <p>Votre <strong>parrain</strong> vient de recevoir une sollicitation de <strong>${proName}</strong> sur BUUPP — et elle pourrait <strong>aussi vous intéresser</strong>.</p>
      <p>En tant que filleul·e, vous pouvez l'accepter et toucher votre récompense de <strong>${rewardStr}&nbsp;€</strong>. Si votre profil n'est pas encore complet, <strong>renseignez vos informations</strong> pour pouvoir accepter et percevoir vos gains.</p>
      ${deadlineStr ? `<p style="color:#64748B;font-size:13px;">À accepter avant le <strong>${deadlineStr}</strong>.</p>` : ""}
      <p style="margin:24px 0;">
        <a href="${linkUrl}" style="background:#4F46E5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600;">Voir la sollicitation</a>
      </p>
      <p style="color:#64748B;font-size:12px;">— L'équipe BUUPP</p>
    </div>
  </body></html>`;

  await transport.sendMail({
    from: getFromAddress(),
    to: email,
    subject,
    text,
    html,
  });
}
