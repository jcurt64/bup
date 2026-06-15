/**
 * POST /api/pro/segments/broadcast
 * Body : { campaignId: string, filters: SegmentFilters, subject: string, body: string }
 *
 * Diffusion MÉDIÉE d'un message à un segment (SP2). Le pro compose un
 * message ; BUUPP l'envoie par e-mail à tous les prospects du segment (ceux
 * qui ont accepté la campagne ET correspondent aux filtres). Le pro ne voit
 * JAMAIS les adresses — pseudonymisation préservée. Reply-To = e-mail du pro
 * pour que les réponses lui parviennent.
 *
 * Garde-fous :
 *   - pro propriétaire de la campagne + campagne `completed`
 *   - quota anti-spam : 1 e-mail / pro / prospect / campagne (les prospects
 *     déjà sollicités sont ignorés) — partagé avec l'envoi individuel
 *   - plafond BROADCAST_MAX_RECIPIENTS par diffusion
 *   - pixel de tracking inséré par destinataire UNIQUEMENT si consentement
 *     CNIL explicite
 *   - chaque envoi journalisé dans pro_contact_actions (audit anti-spam)
 *
 * Les e-mails partent en `after()` (post-réponse) ; la réponse renvoie les
 * comptages (le quota est réservé de façon synchrone via l'insert d'audit).
 */

import { NextResponse, after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";
import { loadCampaignAudience } from "@/lib/pro/segmentation/load";
import { sanitizeFilters } from "@/lib/pro/segmentation/filter";
import {
  matchedRelationIds,
  partitionRecipients,
  BROADCAST_MAX_RECIPIENTS,
  BROADCAST_MAX_SUBJECT,
  BROADCAST_MAX_BODY,
  type BroadcastRecipient,
} from "@/lib/pro/segmentation/broadcast";
import { hasExplicitEmailTrackingConsent } from "@/lib/cnil/consent";
import { sendProToProspectEmail } from "@/lib/email/pro-to-prospect";

export const runtime = "nodejs";

type IdentRow = {
  prenom: string | null;
  email: string | null;
  email_tracking_consent: boolean | null;
  email_tracking_consent_given_at: string | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { campaignId?: string; filters?: unknown; subject?: string; body?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const campaignId = typeof body.campaignId === "string" ? body.campaignId : "";
  const subject = (body.subject ?? "").trim();
  const bodyText = (body.body ?? "").trim();
  if (!campaignId) return NextResponse.json({ error: "missing_campaign_id" }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "missing_subject" }, { status: 400 });
  if (subject.length > BROADCAST_MAX_SUBJECT)
    return NextResponse.json({ error: "subject_too_long" }, { status: 400 });
  if (!bodyText) return NextResponse.json({ error: "missing_body" }, { status: 400 });
  if (bodyText.length > BROADCAST_MAX_BODY)
    return NextResponse.json({ error: "body_too_long" }, { status: 400 });

  const filters = sanitizeFilters(body.filters);

  const user = await currentUser();
  const proEmail =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  if (!proEmail) return NextResponse.json({ error: "pro_email_missing" }, { status: 422 });
  const proId = await ensureProAccount({ clerkUserId: userId, email: proEmail });

  const admin = createSupabaseAdminClient();
  const sb = admin as unknown as SupabaseClient;

  // Audience de la campagne (gating : propriétaire + campagne close).
  const audience = await loadCampaignAudience(sb, campaignId);
  if (!audience || audience.proAccountId !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!proCanSeeContacts(audience.status)) {
    return NextResponse.json({ error: "campaign_not_closed" }, { status: 403 });
  }

  const relIds = matchedRelationIds(audience.contacts, filters);
  if (relIds.length === 0) {
    return NextResponse.json({ ok: true, total: 0, sent: 0, skippedNoEmail: 0, skippedQuota: 0, skippedCap: 0 });
  }
  const capped = relIds.slice(0, BROADCAST_MAX_RECIPIENTS);
  const skippedCap = relIds.length - capped.length;

  // Détails serveur des relations du segment (jamais lus du body client).
  const { data: rels, error: relErr } = await admin
    .from("relations")
    .select(
      `id, prospect_id,
       campaigns ( name ),
       pro_accounts!relations_pro_account_id_fkey ( raison_sociale ),
       prospects:prospect_id (
         prospect_identity ( prenom, email, email_tracking_consent, email_tracking_consent_given_at )
       )`,
    )
    .in("id", capped)
    .eq("pro_account_id", proId);
  if (relErr) {
    console.error("[/api/pro/segments/broadcast] relations read failed", relErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const rows = (rels ?? []) as Array<{
    id: string;
    prospect_id: string;
    campaigns: { name: string | null } | { name: string | null }[] | null;
    pro_accounts: { raison_sociale: string | null } | { raison_sociale: string | null }[] | null;
    prospects: { prospect_identity: IdentRow | IdentRow[] | null } | { prospect_identity: IdentRow | IdentRow[] | null }[] | null;
  }>;

  const proName =
    (one(rows[0]?.pro_accounts)?.raison_sociale ?? "").trim() || "Un professionnel BUUPP";
  const campaignName = one(rows[0]?.campaigns)?.name ?? "—";

  const recipients: BroadcastRecipient[] = rows.map((r) => {
    const prospect = one(r.prospects);
    const ident = one(prospect?.prospect_identity ?? null);
    return {
      relationId: r.id,
      prospectId: r.prospect_id,
      email: ident?.email ?? null,
      prenom: ident?.prenom ?? null,
      trackingConsent: hasExplicitEmailTrackingConsent(ident),
    };
  });

  // Quota : prospects déjà sollicités par e-mail pour cette campagne.
  const { data: actions } = await admin
    .from("pro_contact_actions")
    .select("prospect_id")
    .eq("pro_account_id", proId)
    .eq("campaign_id", campaignId)
    .eq("kind", "email_sent");
  const alreadyEmailed = new Set<string>(
    (actions ?? []).map((a) => (a as { prospect_id: string }).prospect_id),
  );

  const { eligible, skippedNoEmail, skippedQuota } = partitionRecipients(recipients, alreadyEmailed);

  if (eligible.length === 0) {
    return NextResponse.json({
      ok: true,
      total: relIds.length,
      sent: 0,
      skippedNoEmail,
      skippedQuota,
      skippedCap,
    });
  }

  // Réservation du quota + tokens de tracking via insert d'audit (synchrone).
  const { data: inserted, error: insErr } = await admin
    .from("pro_contact_actions")
    .insert(
      eligible.map((r) => ({
        pro_account_id: proId,
        relation_id: r.relationId,
        prospect_id: r.prospectId,
        campaign_id: campaignId,
        kind: "email_sent" as const,
        email_subject: subject,
        email_body: bodyText,
        // Traçabilité réelle : pixel posé uniquement si consentement CNIL
        // du prospect (cf. sendProToProspectEmail). Sert au taux de lecture.
        tracking_pixel_embedded: r.trackingConsent,
      })),
    )
    .select("prospect_id, tracking_token");
  if (insErr) {
    console.error("[/api/pro/segments/broadcast] audit insert failed", insErr);
    return NextResponse.json({ error: "audit_failed" }, { status: 500 });
  }
  const tokenByProspect = new Map<string, string | null>(
    (inserted ?? []).map((a) => [
      (a as { prospect_id: string }).prospect_id,
      (a as { tracking_token: string | null }).tracking_token,
    ]),
  );

  // Envoi médié, post-réponse (non bloquant).
  after(async () => {
    for (const r of eligible) {
      if (!r.email) continue;
      try {
        await sendProToProspectEmail({
          to: r.email,
          proReplyTo: proEmail,
          proName,
          prospectFirstName: r.prenom,
          campaignName,
          subject,
          body: bodyText,
          trackingToken: tokenByProspect.get(r.prospectId) ?? null,
          trackingConsent: r.trackingConsent,
        });
      } catch (e) {
        console.error("[/api/pro/segments/broadcast] send failed", r.prospectId, e);
      }
    }
  });

  return NextResponse.json({
    ok: true,
    total: relIds.length,
    sent: eligible.length,
    skippedNoEmail,
    skippedQuota,
    skippedCap,
  });
}
