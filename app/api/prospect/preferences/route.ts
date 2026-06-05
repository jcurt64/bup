/**
 * /api/prospect/preferences — préférences de monétisation du prospect
 * (onglet « Préférences » : types de campagne + catégories acceptés).
 *
 *   PATCH → met à jour un sous-ensemble de préférences sur la row maître
 *           `prospects`. Body : { allCampaignTypes?, campaignTypes?,
 *           allCategories?, categories? } (campaignTypes/categories = libellés UI).
 *
 * La LECTURE se fait via GET /api/prospect/donnees (bloc `preferences`),
 * qui interroge déjà la row `prospects` — pas de round-trip dédié.
 *
 * Le rayon de ciblage, l'opt-in national et les paliers partageables sont
 * persistés ailleurs (palier `localisation` + /api/prospect/tier) : ils ne
 * passent PAS par cette route.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import { buildPreferencesPatch } from "@/lib/prospect/preferences";

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

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const patch = buildPreferencesPatch(body as Record<string, unknown>);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_known_fields" }, { status: 400 });
  }

  const prospectId = await getProspectId(userId);
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("prospects")
    .update(patch)
    .eq("id", prospectId);

  if (error) {
    console.error("[/api/prospect/preferences PATCH] update error:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fields: patch });
}
