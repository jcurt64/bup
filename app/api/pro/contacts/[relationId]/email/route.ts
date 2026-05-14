/**
 * POST /api/pro/contacts/[relationId]/email
 * Body : { subject: string, body: string }
 *
 * Envoi d'un email du pro vers le prospect, via le transport SMTP BUUPP.
 * Le From reste BUUPP (l'adresse du pro n'est pas exposée en From) ;
 * le Reply-To est l'email Clerk du pro pour que les réponses arrivent
 * directement chez lui.
 *
 * Quota : 1 email max par (pro × prospect × campagne). Au-delà, 409.
 * L'envoi est persisté dans pro_contact_actions (kind='email_sent')
 * avec subject + body en clair pour audit anti-spam.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { sendProToProspectEmail } from "@/lib/email/pro-to-prospect";

export const runtime = "nodejs";

const MAX_SUBJECT = 200;
const MAX_BODY = 10_000;
const EMAIL_QUOTA = 1;

type RouteContext = { params: Promise<{ relationId: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { relationId } = await ctx.params;
  if (!relationId) {
    return NextResponse.json({ error: "missing_relation_id" }, { status: 400 });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(relationId)) {
    return NextResponse.json({ error: "invalid_relation_id" }, { status: 400 });
  }

  let body: { subject?: string; body?: string };
  try {
    body = (await req.json()) as { subject?: string; body?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const subject = (body.subject ?? "").trim();
  const bodyText = (body.body ?? "").trim();
  if (!subject) {
    return NextResponse.json({ error: "missing_subject" }, { status: 400 });
  }
  if (subject.length > MAX_SUBJECT) {
    return NextResponse.json({ error: "subject_too_long" }, { status: 400 });
  }
  if (!bodyText) {
    return NextResponse.json({ error: "missing_body" }, { status: 400 });
  }
  if (bodyText.length > MAX_BODY) {
    return NextResponse.json({ error: "body_too_long" }, { status: 400 });
  }

  const user = await currentUser();
  const proEmail =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  if (!proEmail) {
    return NextResponse.json({ error: "pro_email_missing" }, { status: 422 });
  }
  const proId = await ensureProAccount({ clerkUserId: userId, email: proEmail });

  const admin = createSupabaseAdminClient();

  // Ownership + récupération des coordonnées du prospect (email,
  // prénom) + raison sociale du pro + nom de campagne. Tout est
  // recopié côté serveur — jamais lu du body client.
  const { data: rel, error: readErr } = await admin
    .from("relations")
    .select(
      `id, pro_account_id, prospect_id, campaign_id, status,
       pro_accounts!relations_pro_account_id_fkey ( raison_sociale ),
       campaigns ( name ),
       prospects:prospect_id (
         prospect_identity ( prenom, email )
       )`,
    )
    .eq("id", relationId)
    .maybeSingle();
  if (readErr) {
    console.error("[/api/pro/contacts/[id]/email] read failed", readErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!rel) {
    return NextResponse.json({ error: "relation_not_found" }, { status: 404 });
  }
  if (rel.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (rel.status !== "accepted" && rel.status !== "settled") {
    return NextResponse.json({ error: "relation_not_accepted" }, { status: 409 });
  }

  const proRow = Array.isArray(rel.pro_accounts) ? rel.pro_accounts[0] : rel.pro_accounts;
  const proName = (proRow?.raison_sociale ?? "").trim() || "Un professionnel BUUPP";
  const camp = Array.isArray(rel.campaigns) ? rel.campaigns[0] : rel.campaigns;
  const campaignName = camp?.name ?? "—";
  const prospect = Array.isArray(rel.prospects) ? rel.prospects[0] : rel.prospects;
  const ident = prospect?.prospect_identity
    ? Array.isArray(prospect.prospect_identity)
      ? prospect.prospect_identity[0]
      : prospect.prospect_identity
    : null;
  const prospectEmail = ident?.email ?? null;
  const prospectFirstName = ident?.prenom ?? null;
  if (!prospectEmail) {
    return NextResponse.json({ error: "prospect_email_missing" }, { status: 422 });
  }

  // Quota anti-spam : 1 email max par (pro × prospect × campagne).
  const { count: alreadySent, error: countErr } = await admin
    .from("pro_contact_actions")
    .select("id", { count: "exact", head: true })
    .eq("pro_account_id", proId)
    .eq("prospect_id", rel.prospect_id)
    .eq("campaign_id", rel.campaign_id)
    .eq("kind", "email_sent");
  if (countErr) {
    console.error("[/api/pro/contacts/[id]/email] quota count failed", countErr);
    return NextResponse.json({ error: "quota_check_failed" }, { status: 500 });
  }
  if ((alreadySent ?? 0) >= EMAIL_QUOTA) {
    return NextResponse.json(
      {
        error: "quota_reached",
        quota: EMAIL_QUOTA,
        message: `Vous avez déjà envoyé ${EMAIL_QUOTA} email à ce prospect pour cette campagne. Le règlement BUUPP limite les sollicitations à ${EMAIL_QUOTA} par campagne.`,
      },
      { status: 409 },
    );
  }

  // Envoi via le template BUUPP (Reply-To = email du pro).
  await sendProToProspectEmail({
    to: prospectEmail,
    proReplyTo: proEmail,
    proName,
    prospectFirstName,
    campaignName,
    subject,
    body: bodyText,
  });

  // Persistance dans pro_contact_actions (avec sujet + corps pour audit).
  const { error: insErr } = await admin.from("pro_contact_actions").insert({
    pro_account_id: proId,
    relation_id: rel.id,
    prospect_id: rel.prospect_id,
    campaign_id: rel.campaign_id,
    kind: "email_sent",
    email_subject: subject,
    email_body: bodyText,
  });
  if (insErr) {
    // L'email est parti, on log et on continue — pas la peine de
    // rejeter le client puisque le travail est fait. Mais on signale
    // dans les logs pour qu'un admin remette l'audit à plat.
    console.error("[/api/pro/contacts/[id]/email] audit insert failed", insErr);
  }

  return NextResponse.json({ ok: true, quotaRemaining: Math.max(0, EMAIL_QUOTA - (alreadySent ?? 0) - 1) });
}
