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
import { computeAndPersistProspectScore } from "@/lib/prospect/score";

export const runtime = "nodejs";

/** Valide une date au format `JJ/MM/AAAA` (jour/mois/année cohérents,
 *  année dans les 120 dernières années, pas de date dans le futur). */
function isValidNaissance(raw: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return false;
  const [d, m, y] = raw.split("/").map(Number);
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const now = new Date();
  const year = now.getUTCFullYear();
  if (y < year - 120 || y > year) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

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

  // Lecture parallèle des 5 tier rows + de la row maître (paliers cachés/supprimés, is_founder).
  const [identity, localisation, vie, pro, patrimoine, prospect] = await Promise.all([
    admin.from("prospect_identity").select("*").eq("prospect_id", prospectId).maybeSingle(),
    admin.from("prospect_localisation").select("*").eq("prospect_id", prospectId).maybeSingle(),
    admin.from("prospect_vie").select("*").eq("prospect_id", prospectId).maybeSingle(),
    admin.from("prospect_pro").select("*").eq("prospect_id", prospectId).maybeSingle(),
    admin.from("prospect_patrimoine").select("*").eq("prospect_id", prospectId).maybeSingle(),
    admin
      .from("prospects")
      .select("hidden_tiers, removed_tiers, is_founder")
      .eq("id", prospectId)
      .single(),
  ]);

  return NextResponse.json({
    identity: rowToUi("identity", identity.data ?? null),
    localisation: rowToUi("localisation", localisation.data ?? null),
    vie: rowToUi("vie", vie.data ?? null),
    pro: rowToUi("pro", pro.data ?? null),
    patrimoine: rowToUi("patrimoine", patrimoine.data ?? null),
    // Métadonnées identité non couvertes par `rowToUi` (champs lus seuls,
    // jamais éditables via PATCH côté client — gérés exclusivement par
    // /api/prospect/phone/verify).
    identityMeta: {
      phoneVerifiedAt:
        (identity.data as { phone_verified_at?: string | null } | null)?.phone_verified_at ?? null,
    },
    hiddenTiers: (prospect.data?.hidden_tiers ?? []) as TierKey[],
    removedTiers: (prospect.data?.removed_tiers ?? []) as TierKey[],
    isFounder: prospect.data?.is_founder === true,
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

  // Date de naissance — seul format accepté en base : `JJ/MM/AAAA`. Le front
  // applique déjà un masque, mais on revalide ici (autoritaire) pour bloquer
  // tout client mal intentionné. Une chaîne vide (clear du champ) reste OK.
  if (
    tier === "identity" &&
    Object.prototype.hasOwnProperty.call(patch, "naissance")
  ) {
    const raw = patch.naissance;
    if (raw != null && raw !== "" && !isValidNaissance(raw)) {
      return NextResponse.json(
        {
          error: "invalid_naissance_format",
          message: "Format attendu : JJ/MM/AAAA (ex. 14/06/1988).",
        },
        { status: 400 },
      );
    }
  }

  // Code postal — 5 chiffres exactement (format français). Le front utilise
  // l'autocomplétion `geo.api.gouv.fr` qui ne renvoie que des codes valides ;
  // on bloque ici toute écriture directe non conforme.
  if (
    tier === "localisation" &&
    Object.prototype.hasOwnProperty.call(patch, "code_postal")
  ) {
    const raw = patch.code_postal;
    if (raw != null && raw !== "" && !/^\d{5}$/.test(raw)) {
      return NextResponse.json(
        {
          error: "invalid_code_postal_format",
          message: "Format attendu : 5 chiffres (ex. 75001).",
        },
        { status: 400 },
      );
    }
  }

  // Revenus — chiffres uniquement (montant en euros, sans séparateur).
  // Le front affiche un message d'erreur en temps réel ; ici on bloque
  // toute écriture non conforme (lettres, ponctuation…).
  if (
    tier === "pro" &&
    Object.prototype.hasOwnProperty.call(patch, "revenus")
  ) {
    const raw = patch.revenus;
    if (raw != null && raw !== "" && !/^\d+$/.test(raw)) {
      return NextResponse.json(
        {
          error: "invalid_revenus_format",
          message: "Renseignez uniquement les chiffres.",
        },
        { status: 400 },
      );
    }
  }

  // Garde-fou : on n'accepte JAMAIS un PATCH direct du téléphone via cette
  // route. La vérif SMS (/api/prospect/phone/verify) est la seule porte
  // d'entrée : sinon un client mal intentionné pourrait écraser un numéro
  // déjà vérifié sans repasser par le code SMS, ce qui contournerait le
  // palier `verifie`.
  if (tier === "identity" && Object.prototype.hasOwnProperty.call(patch, "telephone")) {
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
    .from(TIERS[tier].table)
    .upsert(
      { prospect_id: prospectId, ...patch },
      { onConflict: "prospect_id" },
    );

  if (error) {
    console.error("[/api/prospect/donnees PATCH] upsert error:", error);
    return NextResponse.json({ error: "upsert_failed" }, { status: 500 });
  }

  // Recompute du BUUPP Score juste après l'upsert : la modification d'un
  // palier impacte la complétude (paliers atteints) et la fraîcheur. On
  // évite ainsi un score périmé même si le client n'a pas (encore)
  // re-fetché /api/prospect/score.
  try {
    await computeAndPersistProspectScore(admin, prospectId);
  } catch (e) {
    console.warn("[/api/prospect/donnees PATCH] score recompute failed", e);
  }

  return NextResponse.json({ ok: true, tier, fields: patch });
}
