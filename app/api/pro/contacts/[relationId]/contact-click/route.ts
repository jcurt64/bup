/**
 * POST /api/pro/contacts/[relationId]/contact-click
 * Body : { channel: "call" | "email" | "sms" | "whatsapp" | "facebook" }
 *
 * Enregistre un clic du pro sur l'une des 5 icônes de contact d'un prospect
 * acquis, dans `pro_contact_clicks`. Sert :
 *   - à l'audit admin « Contacts (clics) »,
 *   - de déclencheur au mail de rappel au pro (≥ 3 clics sur un même
 *     prospect en 24 h, tous canaux confondus → cf. contact-click-alert.ts).
 *
 * Ownership requis (relation du pro courant, status accepted|settled).
 * Le mail est planifié via `after()` : non bloquant pour la réponse mais
 * garanti de s'exécuter sur Vercel.
 */

import { NextResponse, after } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { maybeSendProContactAlert } from "@/lib/pro/contact-click-alert";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ relationId: string }> };
const CHANNELS = ["call", "email", "sms", "whatsapp", "facebook"] as const;
type Channel = (typeof CHANNELS)[number];

export async function POST(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { relationId } = await ctx.params;
  if (
    !relationId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(relationId)
  ) {
    return NextResponse.json({ error: "invalid_relation_id" }, { status: 400 });
  }

  let body: { channel?: string };
  try {
    body = (await req.json()) as { channel?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const channel = body.channel as Channel | undefined;
  if (!channel || !CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();

  // Ownership + FK à recopier dans l'event.
  const { data: rel, error: readErr } = await admin
    .from("relations")
    .select("id, pro_account_id, prospect_id, campaign_id, status")
    .eq("id", relationId)
    .maybeSingle();
  if (readErr) {
    console.error("[/api/pro/contacts/[id]/contact-click] read failed", readErr);
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

  const { error: insErr } = await admin.from("pro_contact_clicks").insert({
    pro_account_id: proId,
    relation_id: rel.id,
    prospect_id: rel.prospect_id,
    campaign_id: rel.campaign_id,
    channel,
  });
  if (insErr) {
    console.error("[/api/pro/contacts/[id]/contact-click] insert failed", insErr);
    return NextResponse.json({ error: "audit_failed" }, { status: 500 });
  }

  // Rappel anti-abus : ≥ 3 clics sur ce prospect en 24 h → mail au pro.
  // `after()` : non bloquant mais garanti post-réponse sur Vercel.
  after(async () => {
    try {
      await maybeSendProContactAlert(admin, {
        proId,
        prospectId: rel.prospect_id,
        proEmail: email,
      });
    } catch (e) {
      console.error("[/api/pro/contacts/[id]/contact-click] alert failed", e);
    }
  });

  return NextResponse.json({ ok: true });
}
