/**
 * GET /api/prospect/score/history?range=1M|3M|6M|12M
 *
 * Renvoie la série temporelle des snapshots du BUUPP Score pour le
 * prospect connecté, sur la fenêtre demandée. Alimente le graphique
 * "Évolution" du panel BUUPP Score.
 *
 * Réponse :
 *   {
 *     range: "6M",
 *     since: "2025-11-04",   // YYYY-MM-DD
 *     points: [
 *       { date: "2026-04-15", score: 612, completenessPct: 60, freshnessPct: 100, acceptancePct: 0 },
 *       …
 *     ]
 *   }
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const runtime = "nodejs";

const RANGE_DAYS: Record<string, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "12M": 365,
};

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

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawRange = (url.searchParams.get("range") ?? "6M").toUpperCase();
  const range = RANGE_DAYS[rawRange] ? rawRange : "6M";
  const days = RANGE_DAYS[range];

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);

  const prospectId = await getProspectId(userId);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("prospect_score_history")
    .select(
      "snapshot_date, score, completeness_pct, freshness_pct, acceptance_pct",
    )
    .eq("prospect_id", prospectId)
    .gte("snapshot_date", sinceIso)
    .order("snapshot_date", { ascending: true });

  if (error) {
    console.error("[/api/prospect/score/history] error:", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  return NextResponse.json({
    range,
    since: sinceIso,
    points: (data ?? []).map((r) => ({
      date: r.snapshot_date,
      score: r.score,
      completenessPct: r.completeness_pct,
      freshnessPct: r.freshness_pct,
      acceptancePct: r.acceptance_pct,
    })),
  });
}
