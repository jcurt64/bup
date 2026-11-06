/**
 * POST /api/inbound/brevo?token=<BREVO_INBOUND_TOKEN>
 *
 * Réception des e-mails envoyés aux alias de mise en relation
 * `prospect+r{slug}@mail.buupp.com` via l'« Inbound Parsing » de Brevo
 * (webhook `inboundEmailProcessed`). Remplace le Cloudflare Email Worker,
 * inutilisable depuis que l'apex `buupp.com` reçoit ses e-mails chez IONOS
 * (Cloudflare Email Routing exige l'apex ; cf. runbook
 * cloudflare-workers/relation-email-router).
 *
 * DNS : `mail.buupp.com` MX 10 inbound1.sendinblue.com / 20 inbound2.sendinblue.com.
 *
 * Pour chaque message reçu : on résout l'alias (même logique que
 * /api/inbound/relation/resolve), puis on réexpédie le message au vrai
 * e-mail du prospect via l'API transactionnelle Brevo, avec le pro en
 * « Répondre à » (le prospect a donné son double consentement ; c'est le
 * comportement de l'ancien worker, qui préservait l'expéditeur).
 *
 * Toujours 200 pour les messages traités ou ignorés (alias inconnu, etc.) :
 * Brevo n'a rien à réessayer. 401 si le jeton est absent ou faux, 500 si la
 * configuration manque (Brevo réessaiera).
 */

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveAlias } from "@/lib/aliases/relation-email";

export const runtime = "nodejs";

const MIN_SECRET_LEN = 32;
const ALIAS_RE = /^prospect\+r([a-z0-9]{8,16})@/i;
const BREVO_API = "https://api.brevo.com/v3";
/** Limite Brevo : ~10 Mo par e-mail transactionnel, pièces jointes incluses. */
const MAX_ATTACHMENTS_BYTES = 8 * 1024 * 1024;

type InboundAddress = { Name?: string | null; Address?: string | null };
type InboundAttachment = {
  Name?: string;
  ContentType?: string;
  ContentLength?: number;
  DownloadToken?: string;
};
type InboundItem = {
  From?: InboundAddress;
  To?: InboundAddress[];
  Cc?: InboundAddress[];
  ReplyTo?: InboundAddress | null;
  Subject?: string;
  RawHtmlBody?: string | null;
  RawTextBody?: string | null;
  Attachments?: InboundAttachment[];
};

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Alias BUUPP présents parmi les destinataires (To + Cc), sans doublon. */
function aliasesIn(item: InboundItem): string[] {
  const out = new Set<string>();
  for (const a of [...(item.To ?? []), ...(item.Cc ?? [])]) {
    const m = (a?.Address ?? "").match(ALIAS_RE);
    if (m) out.add(m[1].toLowerCase());
  }
  return [...out];
}

async function downloadAttachments(
  apiKey: string,
  atts: InboundAttachment[],
): Promise<{ name: string; content: string }[]> {
  const out: { name: string; content: string }[] = [];
  let total = 0;
  for (const a of atts) {
    if (!a.DownloadToken || !a.Name) continue;
    if (total + Number(a.ContentLength ?? 0) > MAX_ATTACHMENTS_BYTES) break;
    try {
      const res = await fetch(`${BREVO_API}/inbound/attachments/${encodeURIComponent(a.DownloadToken)}`, {
        headers: { "api-key": apiKey },
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      total += buf.length;
      if (total > MAX_ATTACHMENTS_BYTES) break;
      out.push({ name: a.Name, content: buf.toString("base64") });
    } catch (err) {
      console.warn("[inbound/brevo] attachment download failed", err);
    }
  }
  return out;
}

export async function POST(req: Request) {
  // Jeton dédié au webhook Brevo (passé en query : Brevo ne signe pas ses
  // webhooks inbound). Repli sur INBOUND_RELAY_SECRET.
  const secret = process.env.BREVO_INBOUND_TOKEN ?? process.env.INBOUND_RELAY_SECRET;
  const apiKey = process.env.BREVO_API_KEY;
  if (!secret || secret.length < MIN_SECRET_LEN || !apiKey) {
    console.error("[inbound/brevo] BREVO_INBOUND_TOKEN or BREVO_API_KEY missing");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: { items?: InboundItem[] };
  try {
    payload = (await req.json()) as { items?: InboundItem[] };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const fromAddress =
    (process.env.MAIL_FROM ?? "").match(/[^\s<>]+@[^\s<>]+/)?.[0] ?? "no-reply@buupp.com";
  let forwarded = 0;
  let skipped = 0;

  for (const item of payload.items ?? []) {
    const aliases = aliasesIn(item);
    const sender = item.ReplyTo?.Address || item.From?.Address || null;
    const senderName = (item.From?.Name || sender || "Un professionnel").slice(0, 70);
    if (aliases.length === 0 || !sender) {
      skipped++;
      continue;
    }
    const attachments = item.Attachments?.length
      ? await downloadAttachments(apiKey, item.Attachments)
      : [];

    for (const alias of aliases) {
      const resolved = await resolveAlias(admin, alias);
      if (!resolved?.prospectEmail) {
        skipped++;
        continue;
      }
      const banner =
        `<p style="font:13px/1.5 sans-serif;color:#555;margin:0 0 16px">` +
        `Message de <strong>${escapeHtml(senderName)}</strong> transmis par BUUPP ` +
        `(mise en relation ou campagne Tests &amp; Études que vous avez acceptée). Répondez directement à cet e-mail pour lui écrire.</p>`;
      const html = item.RawHtmlBody
        ? banner + item.RawHtmlBody
        : banner + `<pre style="font:14px/1.5 sans-serif;white-space:pre-wrap">${escapeHtml(item.RawTextBody ?? "")}</pre>`;
      const body: Record<string, unknown> = {
        sender: { name: `${senderName} via BUUPP`, email: fromAddress },
        to: [{ email: resolved.prospectEmail }],
        replyTo: { email: sender, name: senderName },
        subject: item.Subject?.trim() || "(sans objet)",
        htmlContent: html,
        headers: resolved.relationId
          ? { "X-BUUPP-Relation": resolved.relationId }
          : { "X-BUUPP-Study": resolved.studyParticipationId ?? "" },
      };
      if (item.RawTextBody) body.textContent = item.RawTextBody;
      if (attachments.length) body.attachment = attachments;
      try {
        const res = await fetch(`${BREVO_API}/smtp/email`, {
          method: "POST",
          headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          console.error("[inbound/brevo] forward failed", res.status, await res.text().catch(() => ""));
          skipped++;
          continue;
        }
        forwarded++;
      } catch (err) {
        console.error("[inbound/brevo] forward error", err);
        skipped++;
      }
    }
  }

  return NextResponse.json({ ok: true, forwarded, skipped });
}
