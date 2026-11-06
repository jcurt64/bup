/**
 * E-mails du module Tests & Études (spec §10). Un gabarit commun sobre
 * (charte BUUPP) + une fonction par événement. Fire-and-forget via
 * `safeSendMail` : un échec d'envoi ne casse jamais le parcours métier.
 */
import { getFromAddress, safeSendMail } from "./transport";

export const STUDIES_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://www.buupp.com";

const PROSPECT_TAB = `${STUDIES_APP_URL}/prospect?tab=etudes`;
const PRO_TAB = `${STUDIES_APP_URL}/pro?tab=etudes`;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";

type Block = { kind: "p"; text: string } | { kind: "code"; code: string } | { kind: "list"; items: string[] };

export function renderStudyMail(o: {
  title: string;
  blocks: Block[];
  cta?: { label: string; url: string };
  footer?: string;
}): { html: string; text: string } {
  const body = o.blocks
    .map((b) =>
      b.kind === "p"
        ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3A4150;">${esc(b.text)}</p>`
        : b.kind === "code"
          ? `<div style="text-align:center;padding:14px;background:#0F1629;border-radius:10px;margin:0 0 14px;"><span style="font-family:Menlo,Consolas,monospace;font-size:26px;font-weight:700;letter-spacing:.2em;color:#FFFEF8;">${esc(b.code)}</span></div>`
          : `<ul style="margin:0 0 14px;padding-left:20px;font-size:14px;line-height:1.6;color:#3A4150;">${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`,
    )
    .join("");
  const cta = o.cta
    ? `<p style="margin:8px 0 18px;text-align:center;"><a href="${o.cta.url}" style="display:inline-block;padding:13px 28px;background:#4596EC;color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">${esc(o.cta.label)}</a></p>`
    : "";
  const footer = o.footer
    ? `<p style="margin:16px 0 0;font-size:12px;color:#6B7180;line-height:1.5;">${o.footer}</p>`
    : "";
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#F7F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F1629;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EC;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFEF8;border-radius:18px;border:1px solid #EAE3D0;">
<tr><td style="padding:24px 32px 6px;"><div style="font-family:Georgia,serif;font-size:24px;font-weight:600;">BUUPP</div><div style="font-size:11px;color:#6B7180;letter-spacing:.14em;text-transform:uppercase;margin-top:2px;">Tests &amp; Études</div></td></tr>
<tr><td style="padding:14px 32px 26px;"><h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;line-height:1.3;font-weight:500;">${esc(o.title)}</h1>${body}${cta}${footer}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    o.title, "",
    ...o.blocks.flatMap((b) => (b.kind === "p" ? [b.text, ""] : b.kind === "code" ? [b.code, ""] : [...b.items.map((i) => `- ${i}`), ""])),
    ...(o.cta ? [`${o.cta.label} : ${o.cta.url}`, ""] : []),
    "L'équipe BUUPP",
  ].join("\n");
  return { html, text };
}

async function send(to: string, subject: string, r: { html: string; text: string }) {
  await safeSendMail({ from: getFromAddress(), to, subject, html: r.html, text: r.text });
}

export type StudyMailCampaign = {
  title: string;
  proName: string;
  rewardCents: number;
  completionDeadline: string;
  externalUrl?: string | null;
  address?: string | null;
};
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

export async function sendStudyValidatedToProspect(to: string, prenom: string | null, c: StudyMailCampaign, code: string) {
  const where = c.externalUrl ? `Lien : ${c.externalUrl}` : c.address ? `Adresse : ${c.address}` : null;
  await send(to, `C'est parti : « ${c.title} » est validée`, renderStudyMail({
    title: `${prenom ? prenom + ", la" : "La"} campagne « ${c.title} » est validée`,
    blocks: [
      { kind: "p", text: `Le nombre minimum de participants est atteint. Réalisez la tâche demandée par ${c.proName} avant le ${fmtDate(c.completionDeadline)} et transmettez-lui votre code personnel :` },
      { kind: "code", code },
      ...(where ? [{ kind: "p" as const, text: where }] : []),
      { kind: "p", text: `Une fois la tâche faite, cliquez sur « J'ai terminé » dans votre espace. Vous recevrez ${eur(c.rewardCents)} après validation (au plus tard 7 jours après).` },
    ],
    cta: { label: "Ouvrir mon espace", url: PROSPECT_TAB },
  }));
}

export async function sendStudyCanceledToProspect(to: string, prenom: string | null, title: string, others: { id: string; title: string; rewardCents: number }[]) {
  await send(to, `Campagne annulée : « ${title} »`, renderStudyMail({
    title: `${prenom ? prenom + ", la" : "La"} campagne « ${title} » est annulée`,
    blocks: [
      { kind: "p", text: "Le nombre minimum de participants n'a pas été atteint à temps. Votre inscription a été supprimée ; aucune donnée n'a été transmise au professionnel." },
      ...(others.length
        ? [{ kind: "p" as const, text: "D'autres campagnes sont ouvertes :" },
           { kind: "list" as const, items: others.map((o) => `${o.title} — ${eur(o.rewardCents)} : ${STUDIES_APP_URL}/tests-etudes/${o.id}`) }]
        : []),
    ],
    cta: { label: "Voir les campagnes", url: `${STUDIES_APP_URL}/tests-etudes` },
  }));
}

export async function sendStudyReminder(to: string, prenom: string | null, c: StudyMailCampaign, code: string | null) {
  await send(to, `Rappel : « ${c.title} » se termine bientôt`, renderStudyMail({
    title: `${prenom ? prenom + ", plus" : "Plus"} que 48 h pour « ${c.title} »`,
    blocks: [
      { kind: "p", text: `Pensez à réaliser la tâche avant le ${fmtDate(c.completionDeadline)} puis à cliquer « J'ai terminé ». Sans cela, la participation ne pourra pas être rémunérée.` },
      ...(code ? [{ kind: "code" as const, code }] : []),
    ],
    cta: { label: "Ouvrir mon espace", url: PROSPECT_TAB },
  }));
}

export async function sendStudyApproved(to: string, prenom: string | null, title: string, rewardCents: number) {
  await send(to, `${eur(rewardCents)} crédités — « ${title} »`, renderStudyMail({
    title: `${prenom ? prenom + ", votre" : "Votre"} participation est validée`,
    blocks: [{ kind: "p", text: `${eur(rewardCents)} ont été crédités sur votre portefeuille BUUPP pour « ${title} ».` }],
    cta: { label: "Voir mon portefeuille", url: `${STUDIES_APP_URL}/prospect?tab=portefeuille` },
  }));
}

export async function sendStudyRejected(to: string, prenom: string | null, title: string, reason: string) {
  await send(to, `Participation refusée — « ${title} »`, renderStudyMail({
    title: `${prenom ? prenom + ", votre" : "Votre"} participation n'a pas été validée`,
    blocks: [
      { kind: "p", text: `Motif indiqué par le professionnel : ${reason}.` },
      { kind: "p", text: "Si vous avez bien réalisé la tâche, vous pouvez contester ce refus sous 7 jours depuis votre espace. BUUPP tranchera au vu de votre code et de votre commentaire." },
    ],
    cta: { label: "Contester", url: PROSPECT_TAB },
  }));
}

export async function sendStudyDisputeOutcome(to: string, prenom: string | null, title: string, approved: boolean) {
  await send(to, `Contestation tranchée — « ${title} »`, renderStudyMail({
    title: approved ? "Votre contestation est acceptée" : "Votre contestation n'a pas été retenue",
    blocks: [{ kind: "p", text: approved
      ? `${prenom ? prenom + ", votre" : "Votre"} participation à « ${title} » est validée et vous êtes rémunéré(e).`
      : `Après examen, BUUPP confirme le refus de votre participation à « ${title} ».` }],
    cta: { label: "Ouvrir mon espace", url: PROSPECT_TAB },
  }));
}

export async function sendStudyDigest(to: string, prenom: string | null, items: { id: string; title: string; rewardCents: number }[], unsubscribeUrl: string) {
  await send(to, `${items.length} nouvelle${items.length > 1 ? "s" : ""} campagne${items.length > 1 ? "s" : ""} Tests & Études`, renderStudyMail({
    title: `${prenom ? prenom + ", de" : "De"} nouvelles campagnes rémunérées près de chez vous`,
    blocks: [{ kind: "list", items: items.map((i) => `${i.title} — ${eur(i.rewardCents)} : ${STUDIES_APP_URL}/tests-etudes/${i.id}`) }],
    cta: { label: "Voir les campagnes", url: `${STUDIES_APP_URL}/tests-etudes` },
    footer: `Vous recevez cet e-mail (au plus 1 par jour) car vous l'avez activé. <a href="${unsubscribeUrl}" style="color:#6B7180;">Se désabonner</a>`,
  }));
}

export async function sendStudyStatusToPro(to: string, title: string, status: "validated" | "canceled" | "suspended", joined: number) {
  const map = {
    validated: { s: `Campagne validée : « ${title} »`, t: "Votre campagne est validée", p: `${joined} participants inscrits. Vous accédez maintenant à leurs prénoms, alias e-mail et codes. Validez ou refusez chaque participation sous 7 jours ; sans réponse, elle est validée automatiquement.` },
    canceled: { s: `Campagne annulée : « ${title} »`, t: "Votre campagne est annulée", p: `Le seuil minimum n'a pas été atteint (${joined} inscrits). Rien n'a été débité : la totalité du budget réservé est libérée.` },
    suspended: { s: `Campagne suspendue : « ${title} »`, t: "Votre campagne a été suspendue par BUUPP", p: "Suite à des signalements, BUUPP a suspendu cette campagne. Le budget non engagé est libéré. Contactez support@buupp.com pour toute question." },
  }[status];
  await send(to, map.s, renderStudyMail({ title: map.t, blocks: [{ kind: "p", text: map.p }], cta: { label: "Ouvrir mon espace pro", url: PRO_TAB } }));
}

export async function sendStudyProReviewDigest(to: string, rows: { title: string; count: number }[]) {
  await send(to, "Des participations attendent votre validation", renderStudyMail({
    title: "Participations à examiner",
    blocks: [
      { kind: "list", items: rows.map((r) => `${r.title} : ${r.count} participation${r.count > 1 ? "s" : ""}`) },
      { kind: "p", text: "Sans réponse sous 7 jours après le « J'ai terminé » du participant, la participation est validée automatiquement." },
    ],
    cta: { label: "Examiner", url: PRO_TAB },
  }));
}

export async function sendStudyDisputeToPro(to: string, title: string, outcome: "opened" | "approved" | "rejected") {
  const t = outcome === "opened" ? "Un participant conteste un refus" : outcome === "approved" ? "Contestation tranchée : participation validée" : "Contestation tranchée : refus confirmé";
  await send(to, `${t} — « ${title} »`, renderStudyMail({
    title: t,
    blocks: [{ kind: "p", text: outcome === "opened"
      ? "BUUPP va examiner la participation (code, commentaire, motif de refus) et trancher."
      : outcome === "approved" ? "BUUPP a validé la participation contestée ; elle a été débitée de votre budget réservé." : "BUUPP a confirmé votre refus ; rien n'a été débité." }],
    cta: { label: "Ouvrir mon espace pro", url: PRO_TAB },
  }));
}
