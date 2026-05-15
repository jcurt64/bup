/**
 * GET /api/pro/analytics — agrégats de performance des campagnes du pro.
 *
 * Calculés en mémoire à partir de la table `relations` (status finaux et
 * campagnes ciblant chaque palier). Pour les 4 breakdowns (palier, géo,
 * âge, sexe), la base est : `relations` du pro avec status `accepted` ou
 * `settled` (ce qui se compte comme "réussite") joint sur prospects.
 *
 * Query params optionnels :
 * - `?campaignId=<uuid>` : filtre sur une campagne spécifique. "all" ou
 *   absent = toutes les campagnes du pro.
 * - `?period=7d|30d|90d|all` : filtre sur created_at (date de la
 *   sollicitation) ; "all" ou absent = pas de filtre.
 *
 * La liste complète des campagnes du pro (`campaigns`) est TOUJOURS
 * renvoyée pour alimenter le sélecteur, indépendamment des filtres
 * appliqués.
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

const PERIOD_DAYS: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const url = new URL(req.url);
  // Validation stricte : campaignId doit être un UUID, sinon ignoré.
  // period doit être dans la liste des valeurs autorisées, sinon "all".
  const rawCampaignId = (url.searchParams.get("campaignId") ?? "").trim();
  const campaignFilter =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawCampaignId)
      ? rawCampaignId
      : null;
  const rawPeriod = (url.searchParams.get("period") ?? "all").toLowerCase();
  const periodKey = rawPeriod in PERIOD_DAYS ? rawPeriod : "all";
  const periodDays = PERIOD_DAYS[periodKey];
  const sinceIso =
    periodDays !== null
      ? new Date(Date.now() - periodDays * 86_400_000).toISOString()
      : null;

  const admin = createSupabaseAdminClient();

  // Liste complète des campagnes du pro — TOUJOURS retournée pour le
  // sélecteur, indépendante des filtres appliqués aux analytics.
  const { data: campaignsList, error: campErr } = await admin
    .from("campaigns")
    .select("id, name, created_at, status")
    .eq("pro_account_id", proId)
    .order("created_at", { ascending: false });
  if (campErr) {
    console.error("[/api/pro/analytics] campaigns list failed", campErr);
  }
  const campaigns = (campaignsList ?? []).map((c) => ({
    id: c.id,
    name: c.name ?? "(sans nom)",
    status: c.status ?? null,
  }));

  let query = admin
    .from("relations")
    .select(
      `status, decided_at, created_at,
       campaigns ( targeting ),
       prospects:prospect_id (
         prospect_identity ( naissance, genre ),
         prospect_localisation ( ville )
       )`,
    )
    .eq("pro_account_id", proId);

  if (campaignFilter) {
    query = query.eq("campaign_id", campaignFilter);
  }
  if (sinceIso) {
    query = query.gte("created_at", sinceIso);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[/api/pro/analytics] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type Row = {
    status: string;
    decided_at: string | null;
    created_at: string | null;
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
      decidedAt: r.decided_at,
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

  // 5. Heatmap "Meilleurs créneaux" : compte des acceptations par
  //    (jour × heure) sur `decided_at`. Buckets de 2h alignés sur les
  //    libellés affichés côté UI (8, 10, 12, 14, 16, 18, 20). Heure de
  //    Paris pour cohérence avec l'expérience utilisateur. Jours en
  //    convention française (0=Lundi → 6=Dimanche).
  const HOUR_BUCKETS = [8, 10, 12, 14, 16, 18, 20] as const; // start of bucket
  const creneauCounts: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: HOUR_BUCKETS.length }, () => 0),
  );
  // Intl.DateTimeFormat pour conversion fiable vers Europe/Paris,
  // robuste aux changements d'heure été/hiver.
  const parisFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const WEEKDAY_FR: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };
  function bucketIndexForHour(hour: number): number | null {
    // Tout ce qui est avant 7h ou après 21h59 est ignoré (pas de bucket).
    if (hour < 7 || hour > 21) return null;
    // Bucket centré sur 8 (7-9), 10 (9-11), 12 (11-13)... 20 (19-21)
    const idx = Math.round((hour - 8) / 2);
    return idx >= 0 && idx < HOUR_BUCKETS.length ? idx : null;
  }
  for (const r of rows) {
    if (!isWin(r.status) || !r.decidedAt) continue;
    const d = new Date(r.decidedAt);
    if (Number.isNaN(d.getTime())) continue;
    const parts = parisFmt.formatToParts(d);
    const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
    const dayIdx = WEEKDAY_FR[weekdayPart];
    const hour = Number(hourPart);
    if (dayIdx == null || Number.isNaN(hour)) continue;
    const hourIdx = bucketIndexForHour(hour);
    if (hourIdx === null) continue;
    creneauCounts[dayIdx][hourIdx]++;
  }
  const totalCreneau = creneauCounts.reduce(
    (acc, row) => acc + row.reduce((a, b) => a + b, 0),
    0,
  );
  const maxCreneau = creneauCounts.reduce(
    (acc, row) => Math.max(acc, ...row),
    0,
  );

  return NextResponse.json({
    acceptanceByTier, geoBreakdown, ageBreakdown, sexBreakdown,
    creneauHeatmap: {
      hourLabels: HOUR_BUCKETS.map(String),
      // Matrice 7 jours × N heures avec le nombre brut d'acceptations.
      // La UI normalise par maxCreneau pour calibrer l'intensité.
      counts: creneauCounts,
      total: totalCreneau,
      max: maxCreneau,
    },
    sampleSize: { rows: rows.length, wins: rows.filter((r) => isWin(r.status)).length },
    // Métadonnées des filtres appliqués + liste des campagnes pour le UI.
    campaigns,
    filters: {
      campaignId: campaignFilter,
      period: periodKey,
    },
  });
}
