/**
 * GET /api/prospect/score — calcule le BUUPP Score (sur 1000) du prospect
 * connecté et le persiste dans `prospects.bupp_score`. Délègue au helper
 * partagé `lib/prospect/score.ts` (réutilisé après chaque PATCH sur
 * `/api/prospect/donnees` pour garder le score frais en base sans
 * dépendre du fetch côté client).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import { computeAndPersistProspectScore } from "@/lib/prospect/score";

export const runtime = "nodejs";

const TOTAL_TIERS = 5;
const PER_TIER_PCT = 100 / TOTAL_TIERS;

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
  const b = await computeAndPersistProspectScore(admin, prospectId);
  void TOTAL_TIERS; // référencé pour rétro-compat de la doc

  return NextResponse.json({
    score: b.score,
    breakdown: {
      completeness: {
        pct: b.completenessPct,
        filled: b.filledTiers,
        total: b.countedTiers,
        perTier: PER_TIER_PCT,
      },
      freshness: {
        pct: b.freshnessPct,
        lastUpdate: b.lastUpdate,
        ageDays: b.ageDays,
      },
      acceptance: {
        pct: b.acceptancePct,
        accepted: b.acceptedRelations,
        total: b.totalRelations,
      },
    },
  });
}
