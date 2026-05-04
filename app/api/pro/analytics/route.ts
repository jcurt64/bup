/**
 * GET /api/pro/analytics — agrégats de performance des campagnes du pro.
 *
 * Calculés en mémoire à partir de la table `relations` (status finaux et
 * campagnes ciblant chaque palier). Pour les 4 breakdowns (palier, géo,
 * âge, sexe), la base est : `relations` du pro avec status `accepted` ou
 * `settled` (ce qui se compte comme "réussite") joint sur prospects.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { ageFromBirthString } from "@/lib/campaigns/mapping";

export const runtime = "nodejs";

const AGE_BUCKETS: Array<[string, number, number]> = [
  ["18–25", 18, 25], ["26–35", 26, 35], ["36–45", 36, 45],
  ["46–55", 46, 55], ["56–64", 56, 64], ["65+", 65, 200],
];

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("relations")
    .select(
      `status,
       campaigns ( targeting ),
       prospects:prospect_id (
         prospect_identity ( naissance, genre ),
         prospect_localisation ( ville )
       )`,
    )
    .eq("pro_account_id", proId);

  if (error) {
    console.error("[/api/pro/analytics] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type Row = {
    status: string;
    campaigns: { targeting: { requiredTiers?: number[] } | null } | null;
    prospects: {
      prospect_identity: { naissance: string | null; genre: string | null } | null;
      prospect_localisation: { ville: string | null } | null;
    } | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const camp = Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns;
    const id = Array.isArray(r.prospects) ? r.prospects[0] : r.prospects;
    const pi = id?.prospect_identity
      ? (Array.isArray(id.prospect_identity) ? id.prospect_identity[0] : id.prospect_identity)
      : null;
    const pl = id?.prospect_localisation
      ? (Array.isArray(id.prospect_localisation) ? id.prospect_localisation[0] : id.prospect_localisation)
      : null;
    return {
      status: r.status,
      tiers: (camp?.targeting?.requiredTiers ?? []) as number[],
      naissance: pi?.naissance ?? null,
      genre: pi?.genre ?? null,
      ville: pl?.ville ?? null,
    };
  });

  const isWin = (s: string) => s === "accepted" || s === "settled";
  const isFinal = (s: string) =>
    s === "accepted" || s === "settled" || s === "refused" || s === "expired";

  // 1. Acceptance rate by tier (on relations finales).
  const acceptanceByTier = [1, 2, 3, 4, 5].map((tier) => {
    const finals = rows.filter((r) => isFinal(r.status) && r.tiers.includes(tier));
    const wins = finals.filter((r) => isWin(r.status));
    const pct = finals.length === 0 ? 0 : Math.round((wins.length / finals.length) * 100);
    const labels = ["Identification", "Localisation", "Style de vie", "Pro", "Patrimoine"];
    return { tier, label: labels[tier - 1], pct };
  });

  // 2. Geographic top 5 par taux d'acceptation.
  const geoMap = new Map<string, { wins: number; finals: number }>();
  for (const r of rows) {
    if (!isFinal(r.status) || !r.ville) continue;
    const m = geoMap.get(r.ville) || { wins: 0, finals: 0 };
    m.finals++; if (isWin(r.status)) m.wins++;
    geoMap.set(r.ville, m);
  }
  const geoBreakdown = Array.from(geoMap.entries())
    .map(([ville, m]) => ({
      ville,
      contacts: m.wins,
      pct: m.finals === 0 ? 0 : Math.round((m.wins / m.finals) * 100),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  // 3. Age breakdown sur relations gagnées.
  const ageWins = AGE_BUCKETS.map(() => 0);
  let ageTotal = 0;
  for (const r of rows) {
    if (!isWin(r.status)) continue;
    const age = ageFromBirthString(r.naissance);
    if (age == null) continue;
    const idx = AGE_BUCKETS.findIndex(([, lo, hi]) => age >= lo && age <= hi);
    if (idx < 0) continue;
    ageWins[idx]++; ageTotal++;
  }
  const ageBreakdown = AGE_BUCKETS.map(([label], i) => ({
    label,
    pct: ageTotal === 0 ? 0 : Math.round((ageWins[i] / ageTotal) * 100),
  }));

  // 4. Sex breakdown.
  const genres = { femme: 0, homme: 0, autre: 0 } as Record<string, number>;
  let genreTotal = 0;
  for (const r of rows) {
    if (!isWin(r.status)) continue;
    const g = (r.genre || "autre").toLowerCase();
    const key = g === "femme" || g === "homme" ? g : "autre";
    genres[key]++; genreTotal++;
  }
  const sexBreakdown = [
    { label: "Femmes", pct: genreTotal === 0 ? 0 : Math.round((genres.femme / genreTotal) * 100) },
    { label: "Hommes", pct: genreTotal === 0 ? 0 : Math.round((genres.homme / genreTotal) * 100) },
    { label: "Autre / non précisé", pct: genreTotal === 0 ? 0 : Math.round((genres.autre / genreTotal) * 100) },
  ];

  return NextResponse.json({
    acceptanceByTier, geoBreakdown, ageBreakdown, sexBreakdown,
    sampleSize: { rows: rows.length, wins: rows.filter((r) => isWin(r.status)).length },
  });
}
