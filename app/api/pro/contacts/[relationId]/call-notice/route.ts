/**
 * POST /api/pro/contacts/[relationId]/call-notice
 *
 * Envoie au prospect un SMS de préavis d'appel depuis l'expéditeur
 * « BUUPP », avec le code buupp de la campagne (4 derniers caractères de
 * campaigns.code) — déclenché au clic « Appeler maintenant » (canal appel).
 *
 * Dédup : UNE SEULE FOIS par relation. On « réclame » l'envoi via un UPDATE
 * conditionnel atomique (SET call_notice_sms_sent_at = now() WHERE ... IS
 * NULL RETURNING) → insensible aux réouvertures du popup / double-clics. En
 * cas d'échec Brevo, on remet la colonne à NULL pour permettre une nouvelle
 * tentative.
 *
 * Réponses :
 *   200 → { sent: true } | { alreadySent: true } | { skipped: "<raison>" }
 *   401/403/404 → auth / ownership / campagne non clôturée
 *
 * Fire-and-forget côté client : un échec ne bloque jamais l'ouverture du
 * composeur (tel:).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";
import { sendSms } from "@/lib/brevo/sms";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ relationId: string }> };

/** Normalise vers E.164 (force +33 pour un 0X… français). Null si invalide. */
function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  const cleaned = trimmed.startsWith("+")
    ? "+" + trimmed.slice(1).replace(/[^\d]/g, "")
    : trimmed.replace(/[^\d]/g, "");
  const digits = cleaned.replace(/^\+/, "");
  if (digits.length < 8 || digits.length > 16) return null;
  if (!cleaned.startsWith("+")) {
    if (cleaned.startsWith("0") && cleaned.length === 10) {
      return "+33" + cleaned.slice(1);
    }
    return "+" + cleaned;
  }
  return cleaned;
}

export async function POST(_req: Request, ctx: RouteContext) {
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

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("relations")
    .select(
      `id, status, pro_account_id, call_notice_sms_sent_at,
       campaigns ( status, code ),
       prospects:prospect_id ( prospect_identity ( telephone ) )`,
    )
    .eq("id", relationId)
    .maybeSingle();

  if (error) {
    console.error("[/api/pro/contacts/call-notice] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "relation_not_found" }, { status: 404 });
  }

  type Row = {
    id: string;
    status: string;
    pro_account_id: string;
    call_notice_sms_sent_at: string | null;
    campaigns:
      | { status: string; code: string | null }
      | { status: string; code: string | null }[]
      | null;
    prospects:
      | { prospect_identity: { telephone: string | null } | { telephone: string | null }[] | null }
      | { prospect_identity: { telephone: string | null } | { telephone: string | null }[] | null }[]
      | null;
  };
  const row = data as unknown as Row;

  if (row.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (row.status !== "accepted" && row.status !== "settled") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const camp = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns;
  if (!proCanSeeContacts(camp?.status)) {
    return NextResponse.json({ error: "campaign_not_closed" }, { status: 403 });
  }

  // Déjà envoyé → on ne renvoie rien (dédup, insensible aux réouvertures).
  if (row.call_notice_sms_sent_at) {
    return NextResponse.json({ alreadySent: true });
  }

  // Code buupp (4 derniers caractères du code de campagne) + téléphone réel.
  const code = camp?.code ? camp.code.slice(-4).toUpperCase() : null;
  const prospect = Array.isArray(row.prospects) ? row.prospects[0] : row.prospects;
  const identRaw = prospect?.prospect_identity ?? null;
  const ident = Array.isArray(identRaw) ? identRaw[0] ?? null : identRaw;
  const phoneE164 = normalizePhone(ident?.telephone);

  if (!code) return NextResponse.json({ skipped: "no_campaign_code" });
  if (!phoneE164) return NextResponse.json({ skipped: "no_phone" });

  // Réclamation atomique : seule la 1re requête gagne (colonne passe de NULL
  // à now()), les suivantes (double-clic, réouverture) voient déjà une valeur.
  const { data: claimed, error: claimErr } = await admin
    .from("relations")
    .update({ call_notice_sms_sent_at: new Date().toISOString() })
    .eq("id", relationId)
    .is("call_notice_sms_sent_at", null)
    .select("id")
    .maybeSingle();

  if (claimErr) {
    console.error("[/api/pro/contacts/call-notice] claim failed", claimErr);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }
  if (!claimed) {
    // Une autre requête a gagné la course entre-temps.
    return NextResponse.json({ alreadySent: true });
  }

  // SMS de préavis (sans accents → encodage GSM-7, 1 segment, moins de crédits).
  const content =
    `BUUPP : un professionnel va vous appeler dans un instant. ` +
    `Code d'authentification : ${code}. ` +
    `Ne repondez qu'a un appelant qui cite ce code.`;

  try {
    await sendSms(phoneE164, content);
  } catch (err) {
    // Échec Brevo → on relâche la réclamation pour permettre une nouvelle
    // tentative au prochain clic « Appeler ».
    await admin
      .from("relations")
      .update({ call_notice_sms_sent_at: null })
      .eq("id", relationId);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[/api/pro/contacts/call-notice] SMS failed → ${msg}`);
    return NextResponse.json({ error: "sms_failed" }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
