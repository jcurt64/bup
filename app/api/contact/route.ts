/**
 * POST /api/contact
 *
 * Reçoit les messages envoyés depuis la section « Contact » de la page
 * d'accueil et les relaie par e-mail vers la boîte de contact générale
 * (`CONTACT_INBOX`, fallback `support@buupp.com`).
 *
 * Accessible à TOUS les visiteurs (pas d'auth Clerk requise) : un prospect ou
 * un professionnel doit pouvoir nous écrire avant même de créer un compte.
 * Anti-spam minimal : honeypot, taille du body bornée, validation stricte des
 * champs, rate limit par IP — même approche que /api/contact-dpo.
 */

import { NextResponse, after } from "next/server";
import { safeSendMail, getFromAddress } from "@/lib/email/transport";
import { checkRateLimit, getClientIp, hashIp } from "@/lib/rate-limit/check";

export const runtime = "nodejs";

const CONTACT_INBOX = process.env.CONTACT_INBOX ?? "support@buupp.com";

const MAX_EMAIL = 320;
const MAX_NAME = 120;
const MAX_MESSAGE = 4000;

const PROFILES = {
  pro: "Professionnel",
  particulier: "Particulier",
  autre: "Autre",
} as const;
type Profile = keyof typeof PROFILES;

type Body = {
  profile?: string;
  name?: string;
  email?: string;
  message?: string;
  consent?: boolean;
  // Honeypot : doit rester vide. S'il est rempli, on suspecte un bot.
  website?: string;
};

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= MAX_EMAIL;
}

export async function POST(req: Request) {
  // Rate limit anti-spam : 3 messages / 5 min par IP.
  const ipRl = await checkRateLimit({
    key: `contact:ip:${hashIp(getClientIp(req))}`,
    limit: 3,
    windowSec: 300,
  });
  if (!ipRl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          "Trop de messages envoyés. Merci de réessayer dans quelques minutes.",
      },
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

  const profileKey = String(body.profile ?? "").trim();
  const profile: Profile = profileKey in PROFILES ? (profileKey as Profile) : "autre";

  const email = String(body.email ?? "").trim();
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "invalid_email", message: "Adresse e-mail invalide." },
      { status: 400 },
    );
  }

  const name = String(body.name ?? "").trim().slice(0, MAX_NAME);

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

  const profileLabel = PROFILES[profile];
  const mailSubject = `[Contact] ${profileLabel}${name ? ` — ${name}` : ""}`;
  const text = [
    `Profil : ${profileLabel}`,
    `Nom : ${name || "(non renseigné)"}`,
    `E-mail de contact : ${email}`,
    "",
    "Message :",
    message,
    "",
    "—",
    "Envoyé depuis la section Contact de la page d'accueil de buupp.com",
  ].join("\n");

  await safeSendMail({
    from: getFromAddress(),
    to: CONTACT_INBOX,
    replyTo: email,
    subject: mailSubject,
    text,
  });

  // Accusé de réception à l'expéditeur (best-effort, ne bloque pas la réponse).
  // `after()` : non bloquant mais GARANTI de s'exécuter post-réponse sur
  // Vercel — un simple `void` n'est pas garanti (l'instance serverless peut
  // être gelée après le `return`, l'envoi est alors perdu).
  after(async () => {
    await safeSendMail({
      from: getFromAddress(),
      to: email,
      subject: "Nous avons bien reçu votre message — BUUPP",
      text: [
        "Bonjour,",
        "",
        "Merci de nous avoir contactés. Nous avons bien reçu votre message et reviendrons vers vous très rapidement.",
        "",
        "Pour rappel, voici le message que vous nous avez envoyé :",
        "",
        message,
        "",
        "À très vite,",
        "L'équipe BUUPP",
      ].join("\n"),
    });
  });

  return NextResponse.json({ ok: true });
}
