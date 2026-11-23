/**
 * /api/prospect/donnees — profil contact du prospect (« Mes données »).
 *
 * Pivot « mise en relation pure » : seuls prénom, INITIALE du nom, ville
 * (nom de commune seul), sexe, tranche d'âge, téléphone et e-mail sont
 * collectés (table prospect_identity). Ville / sexe / tranche d'âge servent
 * au ciblage des campagnes et ne sont jamais transmis au pro.
 *
 *   GET   → { identity: { prenom, nom, ville, genre, trancheAge, email, telephone },
 *             localisation: {},
 *             vie: {}, pro: {}, patrimoine: {}, hiddenTiers: [], removedTiers: [],
 *             identityMeta, isFounder, preferences }
 *           (shape rétro-compatible avec les apps mobiles publiées ; `nom`
 *           = une seule lettre majuscule).
 *
 *   PATCH → Body : { tier: "identity", fields: { prenom?, nom?, ville?, genre?,
 *                    trancheAge?, email?, telephone? } }
 *           `nom` normalisé côté serveur en son initiale majuscule ; `ville`
 *           trimée, max 120 caractères (nom de commune seul) ; `genre` ∈
 *           femme|homme|autre, `trancheAge` ∈ 18-35|35+ (sinon 400
 *           invalid_genre / invalid_tranche_age).
 *           Tout autre palier (ou champ naissance seul) → 200 no-op.
 *
 * Auth Clerk obligatoire. La row `prospects` est créée à la volée si besoin.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import {
  LEGACY_TIER_KEYS,
  identityRowToUi,
  parseIdentityPatch,
  isTierKey,
} from "@/lib/prospect/donnees";
import { computeAndPersistProspectScore } from "@/lib/prospect/score";
import { rowToPreferences } from "@/lib/prospect/preferences";

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

  const [identity, prospect] = await Promise.all([
    admin
      .from("prospect_identity")
      .select("prenom, nom, ville, genre, tranche_age, email, telephone, phone_verified_at")
      .eq("prospect_id", prospectId)
      .maybeSingle(),
    admin
      .from("prospects")
      .select("is_founder, all_campaign_types, campaign_objectives, all_categories, categories")
      .eq("id", prospectId)
      .single(),
  ]);

  return NextResponse.json({
    identity: identityRowToUi(identity.data ?? null),
    // Paliers supprimés — objets vides conservés pour les clients publiés.
    localisation: {},
    vie: {},
    pro: {},
    patrimoine: {},
    // Métadonnée lue seule (gérée par /api/prospect/phone/verify).
    identityMeta: {
      phoneVerifiedAt: identity.data?.phone_verified_at ?? null,
    },
    hiddenTiers: [],
    removedTiers: [],
    isFounder: prospect.data?.is_founder === true,
    preferences: rowToPreferences(prospect.data ?? null),
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
      { error: "invalid_tier", message: `tier must be one of ${LEGACY_TIER_KEYS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const tier = body.tier;
  // Paliers supprimés (localisation, vie, pro, patrimoine) : no-op 200 pour
  // ne pas casser les anciens clients — rien n'est stocké.
  if (tier !== "identity") {
    return NextResponse.json({ ok: true, tier, fields: {}, ignored: true });
  }

  const parsed = parseIdentityPatch(body.fields);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: parsed.error,
        message:
          parsed.error === "invalid_genre"
            ? "Sexe invalide (femme, homme ou autre)."
            : "Tranche d'âge invalide (18-35 ou 35+).",
      },
      { status: 400 },
    );
  }
  const patch = parsed.row;
  // Patch vide (ex. uniquement `naissance`, champ supprimé) → no-op 200.
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, tier, fields: {}, ignored: true });
  }

  // Garde-fou : on n'accepte JAMAIS un PATCH direct du téléphone via cette
  // route. La vérif SMS (/api/prospect/phone/verify) est la seule porte
  // d'entrée (sinon un numéro vérifié pourrait être écrasé sans code SMS).
  if (Object.prototype.hasOwnProperty.call(patch, "telephone")) {
    return NextResponse.json(
      {
        error: "telephone_requires_verification",
        message: "Le téléphone ne peut être mis à jour que via la vérification SMS.",
      },
      { status: 400 },
    );
  }

  const prospectId = await getProspectId(userId);
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("prospect_identity")
    .upsert(
      { prospect_id: prospectId, ...patch },
      { onConflict: "prospect_id" },
    );

  if (error) {
    console.error("[/api/prospect/donnees PATCH] upsert error:", error);
    return NextResponse.json({ error: "upsert_failed" }, { status: 500 });
  }

  try {
    await computeAndPersistProspectScore(admin, prospectId);
  } catch (e) {
    console.warn("[/api/prospect/donnees PATCH] score recompute failed", e);
  }

  // Renvoyé en noms UI (`tranche_age` → `trancheAge`).
  const { tranche_age, ...rest } = patch;
  const fields =
    tranche_age === undefined ? rest : { ...rest, trancheAge: tranche_age };
  return NextResponse.json({ ok: true, tier, fields });
}
