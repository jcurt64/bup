/**
 * POST /api/prospect/tier — gestion de la visibilité d'un palier sur l'onglet
 *                           "Mes données".
 *
 * Body : { tier: "identity"|…, action: "hide"|"restore"|"delete" }
 *
 *   - hide    → suspend temporairement le palier (UI le grise + retire du
 *               BUUPP Score). N'efface aucune donnée.
 *   - restore → annule un `hide`.
 *   - delete  → suppression définitive (RGPD art. 17) : vide la row du tier
 *               + l'ajoute à `prospects.removed_tiers`. Si `tier === "identity"`,
 *               cascade : tous les paliers sont vidés et marqués supprimés
 *               (cohérent avec la logique UI dans `deletePermanent`).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import { TIERS, TIER_KEYS, isTierKey, type TierKey } from "@/lib/prospect/donnees";
import { computeAndPersistProspectScore } from "@/lib/prospect/score";

export const runtime = "nodejs";

const ACTIONS = ["hide", "restore", "delete"] as const;
type Action = (typeof ACTIONS)[number];
function isAction(x: unknown): x is Action {
  return typeof x === "string" && (ACTIONS as readonly string[]).includes(x);
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

function emptyRowFor(tier: TierKey): Record<string, null> {
  // Vide chaque colonne mappée (UI → DB) : NULL côté DB.
  const fields = TIERS[tier].fields;
  return Object.fromEntries(Object.values(fields).map((db) => [db, null]));
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { tier?: string; action?: string };
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
  if (!isAction(body.action)) {
    return NextResponse.json(
      { error: "invalid_action", message: `action must be one of ${ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const tier: TierKey = body.tier;
  const action: Action = body.action;
  const prospectId = await getProspectId(userId);
  const admin = createSupabaseAdminClient();

  // Récupère l'état courant des deux arrays — on les muta toujours
  // ensemble pour rester cohérent (un palier "removed" ne reste pas
  // également dans "hidden", par exemple).
  const { data: row, error: readErr } = await admin
    .from("prospects")
    .select("hidden_tiers, removed_tiers")
    .eq("id", prospectId)
    .single();
  if (readErr) {
    console.error("[/api/prospect/tier] read error:", readErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const hidden = new Set<TierKey>((row?.hidden_tiers ?? []) as TierKey[]);
  const removed = new Set<TierKey>((row?.removed_tiers ?? []) as TierKey[]);

  if (action === "hide") {
    hidden.add(tier);
    removed.delete(tier);
  } else if (action === "restore") {
    hidden.delete(tier);
    removed.delete(tier);
  } else {
    // action === "delete" → cascade depuis identity (clé de voûte).
    const targets: TierKey[] = tier === "identity" ? TIER_KEYS : [tier];
    for (const t of targets) {
      hidden.delete(t);
      removed.add(t);
    }
    // Vide les rows correspondantes (RGPD art. 17). Les upsert mettent
    // tous les champs à NULL en conservant la ligne (FK avec d'autres
    // tables possibles → on ne supprime pas la row physique).
    await Promise.all(
      targets.map((t) =>
        admin
          .from(TIERS[t].table)
          .upsert(
            { prospect_id: prospectId, ...emptyRowFor(t) },
            { onConflict: "prospect_id" },
          ),
      ),
    );
  }

  const { error: writeErr } = await admin
    .from("prospects")
    .update({
      hidden_tiers: Array.from(hidden),
      removed_tiers: Array.from(removed),
    })
    .eq("id", prospectId);
  if (writeErr) {
    console.error("[/api/prospect/tier] write error:", writeErr);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }

  // Recompute du BUUPP Score : hide / restore / delete impactent
  // `countedTiers` (removed_tiers) ou les paliers atteints (delete vide
  // les rows). Garde le score en base à jour sans dépendre du client.
  try {
    await computeAndPersistProspectScore(admin, prospectId);
  } catch (e) {
    console.warn("[/api/prospect/tier] score recompute failed", e);
  }

  return NextResponse.json({
    ok: true,
    hiddenTiers: Array.from(hidden),
    removedTiers: Array.from(removed),
  });
}
