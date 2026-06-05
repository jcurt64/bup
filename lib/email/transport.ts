/**
 * Transport e-mail partagé.
 *
 * Priorité : **API e-mail transactionnelle Brevo** (réutilise
 * `BREVO_API_KEY`, déjà utilisée pour le SMS — aucune clé SMTP à gérer,
 * domaine `buupp.com` authentifié DKIM/DMARC pour la délivrabilité).
 *
 * Repli : transport **SMTP nodemailer** si `BREVO_API_KEY` est absente
 * mais que `SMTP_USER`/`SMTP_PASS` sont présents (dev local / Gmail).
 *
 * Si aucune des deux configs n'est disponible, `getTransport()` renvoie
 * `null` → les fonctions d'envoi loggent un avertissement et reviennent
 * silencieusement (l'inscription reste fonctionnelle sans mail).
 *
 * Variables d'environnement :
 *   - BREVO_API_KEY            → active la voie API (recommandé)
 *   - MAIL_FROM                → "BUUPP <no-reply@buupp.com>" (défaut)
 *   - SMTP_HOST/PORT/USER/PASS → repli SMTP uniquement
 *
 * Le shim renvoyé par `getTransport()` expose la même surface que
 * l'ancien transport nodemailer (`sendMail(opts)` →
 * `{ messageId, accepted, rejected }`, `close()`) afin que les 15+
 * modules `lib/email/*` n'aient AUCUNE modification à subir.
 */

import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";

const BREVO_EMAIL_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export type MailResult = {
  messageId: string | null;
  accepted: string[];
  rejected: string[];
};

export interface MailTransport {
  sendMail(opts: SendMailOptions): Promise<MailResult>;
  close(): void;
}

let cached: MailTransport | null = null;
let cachedFor: string | null = null; // signature pour invalider le cache

/** Parse "Nom <email@x.y>" ou "email@x.y" → { name, email }. */
function parseAddress(
  input: unknown,
): { name?: string; email: string } | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<\s*([^>\s]+)\s*>\s*$/);
  if (m) {
    const name = m[1].trim();
    return name ? { name, email: m[2].trim() } : { email: m[2].trim() };
  }
  return { email: s };
}

/** Normalise `to` (string | string[] | "a@b, c@d") en liste d'adresses. */
function parseRecipients(to: unknown): { email: string; name?: string }[] {
  const raw: string[] = Array.isArray(to)
    ? to.map((x) => String(x))
    : String(to ?? "").split(",");
  return raw
    .map((x) => parseAddress(x))
    .filter((x): x is { name?: string; email: string } => !!x && !!x.email);
}

function brevoTransport(apiKey: string): MailTransport {
  return {
    close() {
      /* no-op : pas de socket persistant côté API HTTP */
    },
    async sendMail(opts: SendMailOptions): Promise<MailResult> {
      const sender = parseAddress(opts.from) ?? {
        name: "BUUPP",
        email: "no-reply@buupp.com",
      };
      const to = parseRecipients(opts.to);
      if (to.length === 0) throw new Error("brevo: aucun destinataire");

      const html = typeof opts.html === "string" ? opts.html : undefined;
      const text = typeof opts.text === "string" ? opts.text : undefined;
      if (!html && !text) {
        throw new Error("brevo: htmlContent ou textContent requis");
      }

      let replyTo: { name?: string; email: string } | null = null;
      if (opts.replyTo) {
        if (typeof opts.replyTo === "string") {
          replyTo = parseAddress(opts.replyTo);
        } else {
          const r = opts.replyTo as { name?: string; address?: string };
          replyTo = r.address
            ? { email: r.address, ...(r.name ? { name: r.name } : {}) }
            : null;
        }
      }
      // Reply-To par défaut (support@) quand l'appelant n'en fournit pas.
      if (!replyTo) replyTo = parseAddress(getReplyToAddress());

      const body: Record<string, unknown> = {
        sender,
        to,
        subject: String(opts.subject ?? ""),
      };
      if (html) body.htmlContent = html;
      if (text) body.textContent = text;
      if (replyTo?.email) body.replyTo = replyTo;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      let res: Response;
      try {
        res = await fetch(BREVO_EMAIL_ENDPOINT, {
          method: "POST",
          headers: {
            "api-key": apiKey,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
          `brevo email API ${res.status}: ${errText.slice(0, 300)}`,
        );
      }
      const json = (await res.json().catch(() => ({}))) as {
        messageId?: string;
      };
      return {
        messageId: json.messageId ?? null,
        accepted: to.map((t) => t.email),
        rejected: [],
      };
    },
  };
}

function smtpTransport(
  user: string,
  pass: string,
  host: string,
  port: number,
): MailTransport {
  const tx = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // SSL implicite sur 465, STARTTLS sur 587.
    auth: { user, pass },
  });
  return {
    close() {
      tx.close();
    },
    async sendMail(opts: SendMailOptions): Promise<MailResult> {
      // Reply-To par défaut (support@) si l'appelant n'en fournit pas.
      const info = await tx.sendMail({
        ...opts,
        replyTo: opts.replyTo ?? getReplyToAddress(),
      });
      return {
        messageId: info.messageId ?? null,
        accepted: (info.accepted ?? []).map((a) => String(a)),
        rejected: (info.rejected ?? []).map((a) => String(a)),
      };
    },
  };
}

export function getTransport(): MailTransport | null {
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    const sig = `brevo|${brevoKey.slice(-6)}`;
    if (cached && cachedFor === sig) return cached;
    if (cached) cached.close();
    cached = brevoTransport(brevoKey);
    cachedFor = sig;
    return cached;
  }

  // Repli SMTP (dev local / Gmail) si pas de clé Brevo.
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? 465);
  if (!user || !pass) {
    if (cached) {
      cached.close();
      cached = null;
      cachedFor = null;
    }
    console.warn(
      "[email] Ni BREVO_API_KEY ni SMTP_USER/SMTP_PASS — l'envoi de mails est désactivé.",
    );
    return null;
  }
  const sig = `smtp|${user}|${host}|${port}`;
  if (cached && cachedFor === sig) return cached;
  if (cached) cached.close();
  cached = smtpTransport(user, pass, host, port);
  cachedFor = sig;
  return cached;
}

export function getFromAddress(): string {
  // Domaine buupp.com authentifié (DKIM/DMARC) → expéditeur de marque.
  return process.env.MAIL_FROM ?? "BUUPP <no-reply@buupp.com>";
}

export function getReplyToAddress(): string {
  // Reply-To par défaut : comme l'expéditeur est `no-reply@`, on dirige les
  // réponses vers une vraie boîte (support@buupp.com, IONOS). Override via
  // MAIL_REPLY_TO. N'est appliqué QUE si l'appelant n'a pas fixé son propre
  // Reply-To (ex. pro→prospect = email du pro, DPO = dp.buupp@).
  return process.env.MAIL_REPLY_TO ?? "support@buupp.com";
}

/**
 * Envoie un mail en avalant les erreurs : trace l'incident côté admin
 * via `system.email_failed` (warning) et continue. À utiliser depuis
 * tous les chemins métier qui veulent envoyer un mail sans risquer de
 * planter la requête principale.
 */
export async function safeSendMail(opts: SendMailOptions): Promise<void> {
  const transport = getTransport();
  if (!transport) return;
  try {
    await transport.sendMail(opts);
  } catch (err) {
    console.error("[email/transport] sendMail failed", err);
    void (async () => {
      const { recordEvent } = await import("@/lib/admin/events/record");
      await recordEvent({
        type: "system.email_failed",
        severity: "warning",
        payload: {
          subject: String(opts.subject ?? ""),
          to: String(opts.to ?? ""),
          err: String(err),
        },
      });
    })();
  }
}
