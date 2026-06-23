/**
 * /api/admin/broadcasts — création + historique des messages broadcast admin.
 *
 *   POST (multipart/form-data) → crée un broadcast, upload la pièce jointe
 *   éventuelle dans le bucket `admin-broadcasts`, déclenche l'envoi email
 *   fire-and-forget vers l'audience visée. Renvoie `{ id, recipientCount }`.
 *
 *   GET → retourne les 50 derniers broadcasts avec le nombre de
 *   destinataires courant par audience (calculé à la volée).
 *
 * Auth : admin uniquement (`requireAdminRequest`).
 */

import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { auth, clerkClient } from "@/lib/clerk/server";
import { hasExplicitEmailTrackingConsent } from "@/lib/cnil/consent";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendBroadcastEmails } from "@/lib/email/admin-broadcast";
import { sendWaitlistBroadcast } from "@/lib/email/waitlist-broadcast";
import { signOptOutToken } from "@/lib/email-tracking/token";
import { referralBadgeTier } from "@/lib/waitlist/referral";

// Liste de destinataires AVANT insertion en base (sans recipient_id). Une
// fois en base, on enrichit avec l'UUID retourné pour pouvoir embarquer
// l'id dans le pixel de tracking côté email.
type RawRecipient = {
  email: string;
  role: "prospect" | "pro";
  /** clerk_user_id — utilisé pour signer le token d'opt-out 1-clic. */
  clerkUserId: string;
  /** Consentement actuel au pixel de tracking (CNIL n° 2026-042). */
  trackingConsent: boolean;
};

export const runtime = "nodejs";

const AUDIENCES = [
  "prospects",
  "pros",
  "all",
  "founders_gold",
  "waitlist",
] as const;
type Audience = (typeof AUDIENCES)[number];

// Allowlist mimetype pour l'upload. Largement défensif — on accepte les
// formats usuels métier (CGV en PDF, notes de version, captures), pas
// d'exécutables ni d'archives.
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "text/plain",
  "text/markdown",
]);

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 Mo

export async function POST(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  // `requireAdminRequest` accepte deux modes : session Clerk admin OU
  // header `x-admin-secret`. Dans le 2e cas (M2M : cron, script CLI,
  // test via curl) il n'y a pas de session Clerk → on retombe sur un
  // identifiant sentinelle pour `created_by_admin_id`, ce qui rend la
  // row traçable comme broadcast machine sans planter l'insert.
  const { userId: clerkAdminId } = await auth();
  const adminUserId = clerkAdminId ?? "system:admin-secret";

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const audienceRaw = String(form.get("audience") ?? "").trim();
  const attachment = form.get("attachment");

  if (!title || title.length > 200) {
    return NextResponse.json({ error: "invalid_title" }, { status: 400 });
  }
  if (!body || body.length > 10_000) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!AUDIENCES.includes(audienceRaw as Audience)) {
    return NextResponse.json({ error: "invalid_audience" }, { status: 400 });
  }
  const audience = audienceRaw as Audience;

  let attachmentBlob: File | null = null;
  if (attachment instanceof File && attachment.size > 0) {
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: "attachment_too_large" }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(attachment.type)) {
      return NextResponse.json({ error: "attachment_mimetype" }, { status: 400 });
    }
    attachmentBlob = attachment;
  }

  const admin = createSupabaseAdminClient();

  // 1. Insert de la row d'abord — on a besoin de l'id pour le path Storage.
  const { data: created, error: insertErr } = await admin
    .from("admin_broadcasts")
    .insert({
      title,
      body,
      audience,
      created_by_admin_id: adminUserId,
    })
    .select("id")
    .single();
  if (insertErr || !created) {
    console.error("[/api/admin/broadcasts POST] insert failed", insertErr);
    // En dev on remonte le détail Supabase au client pour aider au debug
    // (table manquante, RLS, etc.). En prod on garde un message générique.
    const debug =
      process.env.NODE_ENV !== "production" && insertErr
        ? { code: insertErr.code, message: insertErr.message }
        : undefined;
    return NextResponse.json({ error: "insert_failed", debug }, { status: 500 });
  }
  const broadcastId = created.id;

  // 2. Upload de la pièce jointe (best-effort : si l'upload casse, on log et
  //    on continue sans pièce jointe — l'admin peut recréer un broadcast).
  let attachmentPath: string | null = null;
  let attachmentFilename: string | null = null;
  if (attachmentBlob) {
    const safeName = sanitizeFilename(attachmentBlob.name);
    const path = `broadcasts/${broadcastId}/${safeName}`;
    const arrayBuf = await attachmentBlob.arrayBuffer();
    const { error: upErr } = await admin.storage
      .from("admin-broadcasts")
      .upload(path, Buffer.from(arrayBuf), {
        contentType: attachmentBlob.type,
        upsert: false,
      });
    if (upErr) {
      console.error("[/api/admin/broadcasts POST] upload failed", upErr);
    } else {
      attachmentPath = path;
      attachmentFilename = safeName;
      await admin
        .from("admin_broadcasts")
        .update({ attachment_path: path, attachment_filename: safeName })
        .eq("id", broadcastId);
    }
  }

  // 2.bis Audience « liste d'attente » — chemin distinct.
  //   Les inscrits waitlist n'ont pas (encore) de compte BUUPP : ni
  //   clerk_user_id (donc pas de token opt-out / cloche in-app), ni rôle
  //   prospect/pro, ni pixel de mesure CNIL rattaché à un compte. On les
  //   contacte par email simple (perso. avec le prénom), CTA → création
  //   de compte. On ne crée donc PAS de rows admin_broadcast_recipients
  //   (pas de tracking d'ouverture in-app pour cette audience).
  if (audience === "waitlist") {
    const wlRecipients = await collectWaitlistRecipients(admin);

    // Pièce jointe : route /api/me/notifications/[id]/attachment est
    // authentifiée → inutilisable sans compte. On génère une URL signée
    // Storage (30 jours) pour que le lien fonctionne côté waitlist.
    let signedAttachmentUrl: string | null = null;
    if (attachmentPath) {
      const { data: signed, error: signErr } = await admin.storage
        .from("admin-broadcasts")
        .createSignedUrl(attachmentPath, 60 * 60 * 24 * 30);
      if (signErr) {
        console.error("[/api/admin/broadcasts POST] signed url failed", signErr);
      } else {
        signedAttachmentUrl = signed?.signedUrl ?? null;
      }
    }

    await admin
      .from("admin_broadcasts")
      .update({ total_recipients: wlRecipients.length })
      .eq("id", broadcastId);

    const wlSendPromise = sendWaitlistBroadcast({
      broadcastId,
      title,
      body,
      attachmentUrl: signedAttachmentUrl,
      attachmentFilename,
      recipients: wlRecipients,
    })
      .then(async () => {
        await admin
          .from("admin_broadcasts")
          .update({ sent_email_at: new Date().toISOString() })
          .eq("id", broadcastId);
      })
      .catch((err) => {
        console.error("[/api/admin/broadcasts POST] waitlist send loop failed", err);
      });
    try {
      const { after } = await import("next/server");
      after(wlSendPromise);
    } catch {
      void wlSendPromise;
    }

    return NextResponse.json({
      id: broadcastId,
      recipientCount: wlRecipients.length,
      hasAttachment: !!attachmentPath,
    });
  }

  // 3. Construction de la liste des destinataires.
  const recipients = await collectRecipients(admin, audience);

  // 3.b Insert d'une row par destinataire — l'`id` (UUID) sert ensuite
  //     d'identifiant opaque dans l'URL du pixel de tracking. On le fait
  //     AVANT l'envoi mail pour passer les ids au sender. Si l'insert
  //     échoue (très rare), on continue sans tracking — l'envoi mail
  //     reste la priorité.
  type RecipientRow = {
    id: string;
    email: string;
    role: "prospect" | "pro";
    clerkUserId: string;
    trackingConsent: boolean;
  };
  let recipientRows: RecipientRow[] = [];
  if (recipients.length > 0) {
    const { data: inserted, error: insErr } = await admin
      .from("admin_broadcast_recipients")
      .insert(
        recipients.map((r) => ({
          broadcast_id: broadcastId,
          email: r.email,
          role: r.role,
        })),
      )
      .select("id, email, role");
    if (insErr) {
      console.error("[/api/admin/broadcasts POST] recipient insert failed", insErr);
      // Fallback : on simule des ids vides pour ne pas bloquer le tracking
      // côté email (le pixel répondra silencieusement sans incrémenter).
      recipientRows = recipients.map((r) => ({
        id: "00000000-0000-0000-0000-000000000000",
        email: r.email,
        role: r.role,
        clerkUserId: r.clerkUserId,
        trackingConsent: r.trackingConsent,
      }));
    } else {
      // Re-zip avec les recipients pour récupérer clerkUserId + consent
      // (collectRecipients les a déjà rassemblés). On matche par email.
      const consentByEmail = new Map<string, { clerkUserId: string; trackingConsent: boolean }>(
        recipients.map((r) => [r.email.toLowerCase(), { clerkUserId: r.clerkUserId, trackingConsent: r.trackingConsent }]),
      );
      recipientRows = (inserted ?? []).map((r) => {
        const extra = consentByEmail.get(r.email.toLowerCase());
        return {
          id: r.id,
          email: r.email,
          role: r.role as "prospect" | "pro",
          clerkUserId: extra?.clerkUserId ?? "",
          // Si extra manquant (cas marginal), défaut = true (régime transition).
          trackingConsent: extra?.trackingConsent ?? true,
        };
      });
      // Snapshot du total sur la row parent pour les calculs de taux ultérieurs.
      await admin
        .from("admin_broadcasts")
        .update({ total_recipients: recipientRows.length })
        .eq("id", broadcastId);
    }
  }

  // 4. Envoi email fire-and-forget — on ne fait PAS attendre la réponse HTTP
  //    sur la boucle de mails (peut être long si > 50 destinataires).
  const sendPromise = sendBroadcastEmails({
    broadcastId,
    title,
    body,
    hasAttachment: !!attachmentPath,
    attachmentFilename,
    recipients: recipientRows.map((r) => ({
      email: r.email,
      role: r.role,
      recipientId: r.id,
      trackingConsent: r.trackingConsent,
      // Token signé pour l'opt-out 1-clic depuis l'email. Stable par
      // utilisateur (même token = mêmes claims), donc utilisable depuis
      // n'importe quel mail reçu.
      optOutToken: signOptOutToken({ userId: r.clerkUserId, role: r.role }),
    })),
  })
    .then(async () => {
      await admin
        .from("admin_broadcasts")
        .update({ sent_email_at: new Date().toISOString() })
        .eq("id", broadcastId);
    })
    .catch((err) => {
      console.error("[/api/admin/broadcasts POST] send loop failed", err);
    });
  // Sur Vercel Fluid Compute, `waitUntil` permet à la fonction de continuer
  // l'envoi après que la réponse HTTP soit close. Si l'API `waitUntil` n'est
  // pas dispo (env local), on laisse simplement la promesse flotter.
  try {
    const { after } = await import("next/server");
    after(sendPromise);
  } catch {
    void sendPromise;
  }

  return NextResponse.json({
    id: broadcastId,
    recipientCount: recipientRows.length,
    hasAttachment: !!attachmentPath,
  });
}

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_broadcasts")
    .select("id, title, audience, attachment_filename, created_at, sent_email_at, total_recipients")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[/api/admin/broadcasts GET] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const broadcasts = data ?? [];
  const ids = broadcasts.map((b) => b.id);

  // Stats agrégées par broadcast : nombre d'emails ouverts (pixel) + nombre
  // de lectures in-app. Deux requêtes parallèles regroupées par broadcast_id.
  const openCounts = new Map<string, number>();
  const readCounts = new Map<string, number>();
  if (ids.length > 0) {
    const [openRes, readRes] = await Promise.all([
      admin
        .from("admin_broadcast_recipients")
        .select("broadcast_id")
        .in("broadcast_id", ids)
        .not("opened_at", "is", null),
      admin
        .from("admin_broadcast_reads")
        .select("broadcast_id")
        .in("broadcast_id", ids),
    ]);
    for (const r of openRes.data ?? []) {
      openCounts.set(r.broadcast_id, (openCounts.get(r.broadcast_id) ?? 0) + 1);
    }
    for (const r of readRes.data ?? []) {
      readCounts.set(r.broadcast_id, (readCounts.get(r.broadcast_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    broadcasts: broadcasts.map((b) => {
      const total = b.total_recipients ?? 0;
      const opens = openCounts.get(b.id) ?? 0;
      const reads = readCounts.get(b.id) ?? 0;
      return {
        id: b.id,
        title: b.title,
        audience: b.audience,
        attachmentFilename: b.attachment_filename,
        createdAt: b.created_at,
        sentEmailAt: b.sent_email_at,
        totalRecipients: total,
        emailOpenCount: opens,
        inAppReadCount: reads,
        // Taux arrondis à l'entier pour l'affichage admin — pas besoin de
        // décimales sur ces métriques approximatives (cf. caveat Apple MPP).
        emailOpenRate: total > 0 ? Math.round((opens * 100) / total) : null,
        inAppReadRate: total > 0 ? Math.round((reads * 100) / total) : null,
      };
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

// Destinataires de l'audience « liste d'attente » : on lit directement
// la table `waitlist` (email + prénom). Dédup insensible à la casse.
async function collectWaitlistRecipients(
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<{ email: string; prenom: string }[]> {
  const { data, error } = await admin
    .from("waitlist")
    .select("email, prenom")
    .not("email", "is", null);
  if (error) {
    console.error("[broadcasts] waitlist read failed", error);
    return [];
  }
  const seen = new Set<string>();
  const out: { email: string; prenom: string }[] = [];
  for (const r of data ?? []) {
    const email = (r.email ?? "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ email, prenom: (r.prenom ?? "").trim() });
  }
  return out;
}

async function collectRecipients(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  audience: Audience,
): Promise<RawRecipient[]> {
  const recipients: RawRecipient[] = [];
  const seenEmails = new Set<string>();

  const addUnique = (
    email: string | null,
    role: "prospect" | "pro",
    clerkUserId: string | null,
    trackingConsent: boolean,
  ) => {
    if (!email || !clerkUserId) return;
    const key = email.toLowerCase();
    if (seenEmails.has(key)) return;
    seenEmails.add(key);
    recipients.push({ email, role, clerkUserId, trackingConsent });
  };

  if (audience === "founders_gold") {
    // 1. ref_codes ayant atteint le palier Or (>= 10 filleuls).
    const { data: refRows, error: refErr } = await admin
      .from("waitlist")
      .select("referrer_ref_code")
      .not("referrer_ref_code", "is", null);
    if (refErr) {
      console.error("[broadcasts] founders_gold referrers read failed", refErr);
      return recipients;
    }
    const counts = new Map<string, number>();
    for (const r of refRows ?? []) {
      const c = r.referrer_ref_code as string;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const goldCodes = [...counts.entries()]
      .filter(([, n]) => referralBadgeTier(n) === "or")
      .map(([code]) => code);
    if (goldCodes.length === 0) return recipients;

    // 2. emails des parrains gold (waitlist.ref_code ∈ goldCodes).
    const { data: parrainRows } = await admin
      .from("waitlist")
      .select("email, ref_code")
      .in("ref_code", goldCodes);
    const goldEmails = new Set(
      (parrainRows ?? []).map((r) => (r.email ?? "").toLowerCase()).filter(Boolean),
    );
    if (goldEmails.size === 0) return recipients;

    // 3. prospects correspondants (email + clerk_user_id + consentement CNIL).
    const { data: rows, error } = await admin
      .from("prospect_identity")
      .select("email, email_tracking_consent, email_tracking_consent_given_at, prospects(clerk_user_id)")
      .not("email", "is", null);
    if (error) {
      console.error("[broadcasts] founders_gold prospect_identity read failed", error);
    } else {
      for (const r of rows ?? []) {
        if (!goldEmails.has((r.email ?? "").toLowerCase())) continue;
        const clerkUserId = (r.prospects as { clerk_user_id: string } | null)?.clerk_user_id ?? null;
        addUnique(r.email, "prospect", clerkUserId, hasExplicitEmailTrackingConsent(r));
      }
    }
    return recipients;
  }

  if (audience === "prospects" || audience === "all") {
    // Prospects : join prospect_identity ↔ prospects pour récupérer
    // l'email, le clerk_user_id (pour le token opt-out) et le flag de
    // consentement au tracking (CNIL n° 2026-042).
    const { data: rows, error } = await admin
      .from("prospect_identity")
      .select(
        "email, email_tracking_consent, email_tracking_consent_given_at, prospects(clerk_user_id)",
      )
      .not("email", "is", null);
    if (error) {
      console.error("[broadcasts] prospect_identity read failed", error);
    } else {
      for (const r of rows ?? []) {
        // La jointure renvoie `prospects` comme objet (one-to-one via FK).
        const clerkUserId =
          (r.prospects as { clerk_user_id: string } | null)?.clerk_user_id ?? null;
        // Critère CNIL strict : default DB `true` ne suffit pas, on
        // exige un given_at posé par une action utilisateur explicite.
        addUnique(r.email, "prospect", clerkUserId, hasExplicitEmailTrackingConsent(r));
      }
    }
  }

  if (audience === "pros" || audience === "all") {
    // Pros : on lit clerk_user_id + flag tracking côté DB, l'email vient
    // de Clerk via getUserList (pas de colonne email persistée).
    const { data: pros, error } = await admin
      .from("pro_accounts")
      .select("clerk_user_id, email_tracking_consent, email_tracking_consent_given_at");
    if (error) {
      console.error("[broadcasts] pro_accounts read failed", error);
    } else {
      const proIds = (pros ?? []).map((p) => p.clerk_user_id);
      // Map clerk_user_id → consentement effectif CNIL (cf. lib/cnil/consent.ts).
      const consentByClerkId = new Map<string, boolean>(
        (pros ?? []).map((p) => [p.clerk_user_id, hasExplicitEmailTrackingConsent(p)]),
      );
      if (proIds.length > 0) {
        try {
          const client = await clerkClient();
          // `userId: [...]` filtre côté Clerk. Page de 500 par défaut.
          // Au-delà, paginer (out of scope v1 — cf. spec §Risques).
          const res = await client.users.getUserList({ userId: proIds, limit: 500 });
          for (const u of res.data) {
            const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId);
            addUnique(
              primary?.emailAddress ?? null,
              "pro",
              u.id,
              consentByClerkId.get(u.id) ?? false,
            );
          }
        } catch (err) {
          console.error("[broadcasts] clerk getUserList failed", err);
        }
      }
    }
  }

  return recipients;
}

function sanitizeFilename(name: string): string {
  // Évite les chemins relatifs, espaces problématiques et caractères ambigus.
  // Tronque à 120 char pour ne pas dépasser les limites Storage.
  const base = name.split(/[\\/]/).pop() ?? "fichier";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  return cleaned || "fichier";
}
