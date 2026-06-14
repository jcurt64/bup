/**
 * GET /api/pro/contacts/[relationId]/details
 *
 * Renvoie au pro authentifié l'INTÉGRALITÉ des catégories de données
 * que sa campagne a payées (campaign.targeting.requiredTiers), pour un
 * prospect qui a accepté la mise en relation.
 *
 * Garde-fous (RGPD — minimisation + consentement) :
 *   - relation rattachée au pro courant
 *   - status ∈ {accepted, settled}
 *   - on ne renvoie QUE les paliers présents dans requiredTiers (= ce
 *     que le pro a effectivement payé)
 *   - on EXCLUT tout palier que le prospect a masqué ou supprimé
 *     (hidden_tiers / removed_tiers)
 *   - l'e-mail n'est JAMAIS renvoyé en clair : alias watermarqué
 *     `prospect+rXXX@buupp.com` (invariant anti-fraude du projet)
 *
 * Chaque ouverture est journalisée dans pro_contact_reveals
 * (field='details') — accountability RGPD art. 5.2.
 *
 * 200 → { tiers: [{ key, label, items: [{ label, value }] }] }
 * 401 → non authentifié
 * 403 → relation introuvable / wrong pro / status non accepted|settled
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { tierNumsToKeys } from "@/lib/campaigns/mapping";
import {
  buildAliasAddress,
  getOrCreateRelationAlias,
} from "@/lib/aliases/relation-email";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";
import { pseudonymizeTierItems } from "@/lib/pro/pseudonymize";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ relationId: string }> };
type TierKey = "identity" | "localisation" | "vie" | "pro" | "patrimoine";

type TierTable =
  | "prospect_identity"
  | "prospect_localisation"
  | "prospect_vie"
  | "prospect_pro"
  | "prospect_patrimoine";

const TIER_TABLE: Record<TierKey, TierTable> = {
  identity: "prospect_identity",
  localisation: "prospect_localisation",
  vie: "prospect_vie",
  pro: "prospect_pro",
  patrimoine: "prospect_patrimoine",
};

const TIER_LABEL: Record<TierKey, string> = {
  identity: "Identification",
  localisation: "Localisation",
  vie: "Style de vie",
  pro: "Données professionnelles",
  patrimoine: "Patrimoine & projets",
};

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
      `id, status, pro_account_id, prospect_id,
       campaigns ( status, targeting ),
       prospects:prospect_id ( id, removed_tiers, hidden_tiers )`,
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

  type Row = {
    id: string;
    status: string;
    pro_account_id: string;
    prospect_id: string;
    campaigns:
      | { status: string; targeting: { requiredTiers?: number[] } | null }
      | { status: string; targeting: { requiredTiers?: number[] } | null }[]
      | null;
    prospects:
      | { id: string; removed_tiers: string[] | null; hidden_tiers: string[] | null }
      | { id: string; removed_tiers: string[] | null; hidden_tiers: string[] | null }[]
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
  const prospect = Array.isArray(row.prospects)
    ? row.prospects[0]
    : row.prospects;
  if (!prospect) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const requiredNums = (camp?.targeting?.requiredTiers ?? [1]) as number[];
  const requiredKeys = tierNumsToKeys(requiredNums) as TierKey[];
  const blocked = new Set<string>([
    ...((prospect.removed_tiers ?? []) as string[]),
    ...((prospect.hidden_tiers ?? []) as string[]),
  ]);

  // Paliers à révéler : payés par le pro ET non masqués/supprimés par
  // le prospect. Ordre canonique 1→5.
  const ORDER: TierKey[] = [
    "identity",
    "localisation",
    "vie",
    "pro",
    "patrimoine",
  ];
  const toReveal = ORDER.filter(
    (k) => requiredKeys.includes(k) && !blocked.has(k),
  );

  // Alias e-mail watermarqué — généré une fois si le palier identity
  // est révélé (on ne renvoie jamais le vrai e-mail).
  let aliasEmail: string | null = null;
  if (toReveal.includes("identity")) {
    try {
      const slug = await getOrCreateRelationAlias(admin, relationId);
      aliasEmail = buildAliasAddress(slug);
    } catch (err) {
      console.error("[/api/pro/contacts/details] alias gen failed", err);
    }
  }

  const tiers: Array<{
    key: TierKey;
    label: string;
    items: Array<{ label: string; value: string | null }>;
  }> = [];

  for (const key of toReveal) {
    const { data: tierRow } = await admin
      .from(TIER_TABLE[key])
      .select("*")
      .eq("prospect_id", prospect.id)
      .maybeSingle();
    const r = (tierRow ?? {}) as Record<string, unknown>;

    // Pseudonymisation des valeurs selon les règles fixées (cf.
    // lib/pro/pseudonymize). L'e-mail reçoit l'alias watermarqué ; les
    // champs en suppression (adresse précise, poste, revenus, épargne) sont
    // omis ; date de naissance → tranche d'âge ; code postal → département ;
    // prénom/nom masqués ; téléphone conservé.
    const items = pseudonymizeTierItems(key, r, { aliasEmail });

    tiers.push({ key, label: TIER_LABEL[key], items });
  }

  // Audit best-effort — ne casse pas l'usage si l'insert échoue.
  const { error: auditErr } = await admin.from("pro_contact_reveals").insert({
    pro_account_id: proId,
    relation_id: relationId,
    field: "details",
  });
  if (auditErr) {
    console.error("[/api/pro/contacts/details] audit insert failed", auditErr);
  }

  return NextResponse.json({ tiers });
}
