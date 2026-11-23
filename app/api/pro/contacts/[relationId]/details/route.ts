/**
 * GET /api/pro/contacts/[relationId]/details
 *
 * Fiche d'un prospect ayant accepté la mise en relation.
 *
 * Pivot « mise en relation pure » : le pro ne reçoit QUE le prénom et
 * l'initiale du nom (+ l'alias e-mail watermarqué relayé par BUUPP si la
 * campagne a le canal « email »). Le téléphone et l'e-mail bruts ne sont
 * jamais renvoyés ; l'appel passe par le flux « Appeler » (révélation
 * journalisée + SMS de préavis) si la campagne a le canal « phone ».
 *
 * Garde-fous : relation du pro courant, status ∈ {accepted, settled},
 * campagne clôturée. Chaque ouverture est journalisée (pro_contact_reveals,
 * field='details') — FAIL-CLOSED.
 *
 * 200 → {
 *   tiers: [{ key: "identity", label, items: [{ label, value }] }],
 *   ref, priority, fiabiliteAgg, authCode,
 *   contactChannels: ("phone"|"email")[],
 *   contact: { canCall: boolean, canEmail: boolean, aliasEmail: string|null }
 * }
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import {
  buildAliasAddress,
  getOrCreateRelationAlias,
} from "@/lib/aliases/relation-email";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";
import { computeFiabiliteAgg } from "@/lib/prospect/score";
import { pseudonymizeTierItems } from "@/lib/pro/pseudonymize";
import { readContactChannels } from "@/lib/campaigns/contact-channels";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ relationId: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { relationId } = await ctx.params;
  if (!relationId) {
    return NextResponse.json({ error: "missing_relation_id" }, { status: 400 });
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
      `id, status, pro_account_id, prospect_id, pro_priority, pro_validated_at,
       campaigns ( status, code, contact_channels ),
       prospects:prospect_id ( id, prospect_identity ( prenom, nom, email, telephone ) )`,
    )
    .eq("id", relationId)
    .maybeSingle();

  if (error) {
    console.error("[/api/pro/contacts/details] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  type Ident = { prenom: string | null; nom: string | null; email: string | null; telephone: string | null };
  type Camp = { status: string; code: string | null; contact_channels: string[] | null };
  type Row = {
    id: string;
    status: string;
    pro_account_id: string;
    prospect_id: string;
    pro_priority: number | null;
    pro_validated_at: string | null;
    campaigns: Camp | Camp[] | null;
    prospects:
      | { id: string; prospect_identity: Ident | Ident[] | null }
      | { id: string; prospect_identity: Ident | Ident[] | null }[]
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
  const prospect = Array.isArray(row.prospects) ? row.prospects[0] : row.prospects;
  if (!prospect) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const identRaw = prospect.prospect_identity;
  const ident = (Array.isArray(identRaw) ? identRaw[0] : identRaw) ?? null;

  const contactChannels = readContactChannels(camp?.contact_channels);
  const canEmail = contactChannels.includes("email") && !!ident?.email;
  const canCall = contactChannels.includes("phone") && !!ident?.telephone;

  // Alias e-mail watermarqué (on ne renvoie jamais le vrai e-mail). Le slug
  // sert aussi de RÉFÉRENCE de fiche affichée dans l'en-tête.
  let aliasEmail: string | null = null;
  let ref: string | null = null;
  try {
    const slug = await getOrCreateRelationAlias(admin, relationId);
    ref = slug.toUpperCase();
    if (canEmail) aliasEmail = buildAliasAddress(slug);
  } catch (err) {
    console.error("[/api/pro/contacts/details] alias gen failed", err);
  }

  const items = pseudonymizeTierItems(
    "identity",
    (ident ?? {}) as Record<string, unknown>,
    { aliasEmail, channels: contactChannels },
  );
  const tiers = [{ key: "identity" as const, label: "Contact", items }];

  // Audit FAIL-CLOSED — la fiche n'est livrée QUE si son ouverture a pu être
  // journalisée. Si l'insert échoue, 500 SANS exposer les données.
  const { error: auditErr } = await admin.from("pro_contact_reveals").insert({
    pro_account_id: proId,
    relation_id: relationId,
    field: "details",
  });
  if (auditErr) {
    console.error("[/api/pro/contacts/details] audit insert failed", auditErr);
    return NextResponse.json({ error: "audit_failed" }, { status: 500 });
  }

  // Agrégat de FIABILITÉ du prospect (cross-pro).
  const fiabiliteAgg = await computeFiabiliteAgg(admin, prospect.id);

  // Code buupp d'authentification = 4 derniers caractères du code campagne.
  const authCode = camp?.code ? camp.code.slice(-4).toUpperCase() : null;

  return NextResponse.json({
    tiers,
    ref,
    priority: row.pro_priority ?? null,
    fiabiliteAgg,
    authCode,
    // Mise en relation confirmée effective par le pro (→ certifié confiance).
    validatedAt: row.pro_validated_at ?? null,
    contactChannels,
    contact: { canCall, canEmail, aliasEmail },
  });
}
