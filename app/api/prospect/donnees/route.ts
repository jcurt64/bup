/**
 * /api/prospect/donnees — lecture/écriture des 5 paliers de l'onglet
 *                         "Mes données" du dashboard prospect.
 *
 *   GET   → retourne les 5 paliers (camelCase, structurés par tier) +
 *           l'état de visibilité (hiddenTiers / removedTiers).
 *
 *   PATCH → upsert d'un sous-ensemble de champs sur un palier donné.
 *           Body : { tier: "identity"|…, fields: { ... } }
 *
 * Auth Clerk obligatoire. La row `prospects` est crée à la volée si elle
 * n'existe pas encore (filet de sécurité quand le webhook Clerk est en
 * retard sur la première visite du dashboard).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import {
  TIERS,
  TIER_KEYS,
  isTierKey,
  rowToUi,
  uiToRow,
  type TierKey,
} from "@/lib/prospect/donnees";

export const runtime = "nodejs";

async function getProspectId(userId: string): Promise<string> {
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  return ensureProspect({
    clerkUserId: userId,
    email,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const prospectId = await getProspectId(userId);
  const admin = createSupabaseAdminClient();

  // Lecture parallèle des 5 tier rows + de la row maître (paliers cachés/supprimés).
  const [identity, localisation, vie, pro, patrimoine, prospect] = await Promise.all([
    admin.from("prospect_identity").select("*").eq("prospect_id", prospectId).maybeSingle(),
    admin.from("prospect_localisation").select("*").eq("prospect_id", prospectId).maybeSingle(),
    admin.from("prospect_vie").select("*").eq("prospect_id", prospectId).maybeSingle(),
    admin.from("prospect_pro").select("*").eq("prospect_id", prospectId).maybeSingle(),
    admin.from("prospect_patrimoine").select("*").eq("prospect_id", prospectId).maybeSingle(),
    admin
      .from("prospects")
      .select("hidden_tiers, removed_tiers")
      .eq("id", prospectId)
      .single(),
  ]);

  return NextResponse.json({
    identity: rowToUi("identity", identity.data ?? null),
    localisation: rowToUi("localisation", localisation.data ?? null),
    vie: rowToUi("vie", vie.data ?? null),
    pro: rowToUi("pro", pro.data ?? null),
    patrimoine: rowToUi("patrimoine", patrimoine.data ?? null),
    hiddenTiers: (prospect.data?.hidden_tiers ?? []) as TierKey[],
    removedTiers: (prospect.data?.removed_tiers ?? []) as TierKey[],
  });
}

type PatchBody = {
  tier?: string;
  fields?: Record<string, unknown>;
};

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isTierKey(body.tier)) {
    return NextResponse.json(
      { error: "invalid_tier", message: `tier must be one of ${TIER_KEYS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const tier = body.tier;
  const patch = uiToRow(tier, body.fields);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_known_fields" }, { status: 400 });
  }

  const prospectId = await getProspectId(userId);
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from(TIERS[tier].table)
    .upsert(
      { prospect_id: prospectId, ...patch },
      { onConflict: "prospect_id" },
    );

  if (error) {
    console.error("[/api/prospect/donnees PATCH] upsert error:", error);
    return NextResponse.json({ error: "upsert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tier, fields: patch });
}
