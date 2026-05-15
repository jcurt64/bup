/**
 * POST /api/contact-dpo
 *
 * Reçoit les demandes RGPD envoyées depuis le formulaire de la page
 * /contact-dpo et les relaie par e-mail vers la boîte du DPO
 * (`DPO_INBOX`, fallback `dp.buupp@buupp.com`).
 *
 * Accessible à TOUS les visiteurs (pas d'auth Clerk requise) car un
 * ancien utilisateur — dont le compte a été supprimé — peut légitimement
 * avoir besoin de contacter le DPO. Anti-spam minimal : honeypot, taille
 * du body bornée, validation stricte des champs.
 */

import { NextResponse } from "next/server";
import { safeSendMail, getFromAddress } from "@/lib/email/transport";
import { sendDpoRequestConfirmation } from "@/lib/email/dpo-request-confirmation";
import { checkRateLimit, getClientIp, hashIp } from "@/lib/rate-limit/check";

export const runtime = "nodejs";

const DPO_INBOX = process.env.DPO_INBOX ?? "dp.buupp@buupp.com";

const MAX_EMAIL = 320;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 4000;

const REQUEST_TYPES = {
  access: "Accès à mes données",
  rectification: "Rectification d'une donnée",
  erasure: "Effacement de mon compte",
  objection: "Opposition au traitement",
  restriction: "Limitation du traitement",
  portability: "Portabilité de mes données",
  leak: "Signalement d'une fuite supposée",
  other: "Autre demande RGPD",
} as const;
type RequestType = keyof typeof REQUEST_TYPES;

type Body = {
  requestType?: string;
  email?: string;
  subject?: string;
  message?: string;
  consent?: boolean;
  // Honeypot : doit rester vide. S'il est rempli, on suspecte un bot.
  website?: string;
};

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= MAX_EMAIL;
}

export async function POST(req: Request) {
  // Rate limit anti-spam : 3 demandes / 5 min par IP. Cap volontairement
  // bas (l'usage légitime est ponctuel : un visiteur exerce un droit RGPD
  // une fois, pas en boucle) tout en évitant qu'un attaquant inonde
  // l'inbox du DPO.
  const ipRl = await checkRateLimit({
    key: `contact-dpo:ip:${hashIp(getClientIp(req))}`,
    limit: 3,
    windowSec: 300,
  });
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Trop de demandes envoyées. Merci de réessayer dans quelques minutes." },
      { status: 429, headers: { "Retry-After": String(ipRl.retryAfterSec) } },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Honeypot — on simule un succès pour ne pas signaler au bot qu'on le détecte.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const requestType = String(body.requestType ?? "").trim();
  if (!(requestType in REQUEST_TYPES)) {
    return NextResponse.json(
      { error: "invalid_request_type", message: "Type de demande invalide." },
      { status: 400 },
    );
  }
  const typedRequest = requestType as RequestType;

  const email = String(body.email ?? "").trim();
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "invalid_email", message: "Adresse e-mail invalide." },
      { status: 400 },
    );
  }

  const subject = String(body.subject ?? "").trim().slice(0, MAX_SUBJECT);
  if (!subject) {
    return NextResponse.json(
      { error: "missing_subject", message: "L'objet est requis." },
      { status: 400 },
    );
  }

  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json(
      { error: "missing_message", message: "Le message ne peut pas être vide." },
      { status: 400 },
    );
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      {
        error: "message_too_long",
        message: `Message trop long (${MAX_MESSAGE} caractères max).`,
      },
      { status: 400 },
    );
  }

  if (body.consent !== true) {
    return NextResponse.json(
      { error: "missing_consent", message: "Le consentement est requis." },
      { status: 400 },
    );
  }

  const typeLabel = REQUEST_TYPES[typedRequest];
  const mailSubject = `[DPO] ${typeLabel} — ${subject}`;
  const text = [
    `Type de demande : ${typeLabel}`,
    `E-mail de contact : ${email}`,
    "",
    `Objet : ${subject}`,
    "",
    "Message :",
    message,
    "",
    "—",
    "Envoyé depuis le formulaire de la page /contact-dpo de buupp.com",
  ].join("\n");

  await safeSendMail({
    from: getFromAddress(),
    to: DPO_INBOX,
    replyTo: email,
    subject: mailSubject,
    text,
  });

  // Envoi en parallèle d'un accusé de réception à l'utilisateur (HTML
  // BUUPP avec récap de sa demande). Ne bloque pas la réponse API si
  // l'envoi échoue — safeSendMail trace l'incident via admin_events.
  void sendDpoRequestConfirmation({
    to: email,
    requestTypeLabel: typeLabel,
    subject,
    message,
  });

  return NextResponse.json({ ok: true });
}
