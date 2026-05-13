/**
 * GET /api/pro/contacts — prospects ayant accepté une mise en relation
 * du pro courant. Email + téléphone watermarqués (politique d'usage BUUPP).
 *
 * Source : table `relations` filtrée sur status='accepted'|'settled' joint
 * sur prospect_identity / prospects / campaigns.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

function maskEmail(e: string | null | undefined): string {
  if (!e) return "—";
  const at = e.indexOf("@");
  if (at < 0) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at);
  return local.slice(0, Math.max(1, local.length - 4)) + "•••" + domain;
}
function maskPhone(p: string | null | undefined): string {
  if (!p) return "—";
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return p;
  const head = digits.slice(0, 2);
  const tail = digits.slice(-2);
  return `${head} •• •• •• ${tail}`;
}
function maskName(prenom: string | null | undefined, nom: string | null | undefined): string {
  const p = (prenom ?? "").trim();
  const n = (nom ?? "").trim();
  const nomMasked = n ? `${n.charAt(0).toUpperCase()}.` : "";
  const out = `${p} ${nomMasked}`.trim();
  return out || "Prospect anonyme";
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
      `id, decided_at, status, campaign_id, evaluation, evaluated_at,
       campaigns ( id, name, targeting ),
       prospects:prospect_id ( id, bupp_score,
         prospect_identity ( prenom, nom, email, telephone )
       )`,
    )
    .eq("pro_account_id", proId)
    .in("status", ["accepted", "settled"])
    .order("decided_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[/api/pro/contacts] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type Row = {
    id: string;
    decided_at: string | null;
    status: string;
    campaign_id: string;
    evaluation: "atteint" | "non_atteint" | null;
    evaluated_at: string | null;
    campaigns: { id: string; name: string; targeting: { requiredTiers?: number[]; channels?: string[] } | null } | null;
    prospects: {
      id: string;
      bupp_score: number;
      prospect_identity: { prenom: string | null; nom: string | null; email: string | null; telephone: string | null } | null;
    } | null;
  };

  const ALL_CHANNELS = ["email", "phone", "sms", "whatsapp", "facebook", "linkedin"];

  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const id = (Array.isArray(r.prospects) ? r.prospects[0] : r.prospects) ?? null;
    const ident = id?.prospect_identity
      ? Array.isArray(id.prospect_identity)
        ? id.prospect_identity[0]
        : id.prospect_identity
      : null;
    const camp = (Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns) ?? null;
    const tiers = (camp?.targeting?.requiredTiers ?? [1]) as number[];
    const tier = Math.max(1, ...tiers.map((n) => Number(n) || 0));
    const fullName = maskName(ident?.prenom, ident?.nom);
    const declared = camp?.targeting?.channels;
    const campaignChannels = Array.isArray(declared) && declared.length > 0
      ? declared.filter((x): x is string => typeof x === "string")
      : ALL_CHANNELS;
    return {
      relationId: r.id,
      name: fullName,
      score: id?.bupp_score ?? 0,
      campaignId: camp?.id ?? r.campaign_id,
      campaign: camp?.name ?? "—",
      campaignChannels,
      tier,
      email: maskEmail(ident?.email),
      telephone: maskPhone(ident?.telephone),
      emailAvailable: !!ident?.email,
      telephoneAvailable: !!ident?.telephone,
      receivedAt: r.decided_at,
      evaluation: r.evaluation,
      evaluatedAt: r.evaluated_at,
    };
  });

  return NextResponse.json({ rows });
}
