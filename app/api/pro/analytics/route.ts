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
 * - `?period=7d|30d|90d|all` : filtre sur sent_at (date de la
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
import { computeMessageOpenStats } from "@/lib/pro/message-opens";

export const runtime = "nodejs";

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
      `status, decided_at, sent_at`,
    )
    .eq("pro_account_id", proId);

  if (campaignFilter) {
    query = query.eq("campaign_id", campaignFilter);
  }
  if (sinceIso) {
    query = query.gte("sent_at", sinceIso);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[/api/pro/analytics] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type Row = { status: string; decided_at: string | null; sent_at: string | null };
  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({
    status: r.status,
    decidedAt: r.decided_at,
  }));

  const isWin = (s: string) => s === "accepted" || s === "settled";
  const isFinal = (s: string) =>
    s === "accepted" || s === "settled" || s === "refused" || s === "expired";

  // 1-4. Pivot « mise en relation pure » : plus de paliers, de localisation,
  //      d'âge ni de genre côté prospect. Les répartitions démographiques sont
  //      renvoyées vides (clés conservées pour les clients publiés) ; le taux
  //      d'acceptation n'a plus qu'une ligne (palier 1 = contact).
  const finalsAll = rows.filter((r) => isFinal(r.status));
  const winsAll = finalsAll.filter((r) => isWin(r.status));
  const acceptanceByTier = [
    {
      tier: 1,
      label: "Contact",
      pct: finalsAll.length === 0 ? 0 : Math.round((winsAll.length / finalsAll.length) * 100),
    },
  ];
  const geoBreakdown: Array<{ ville: string; contacts: number; pct: number }> = [];
  const ageBreakdown: Array<{ label: string; pct: number }> = [];
  const sexBreakdown: Array<{ label: string; pct: number }> = [];

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

  // 6. Taux de lecture des messages pro→prospect. Source : les lignes
  //    pro_contact_actions (kind='email_sent') du pro — qui concernent par
  //    construction des prospects ayant accepté (envoi gaté campagne close +
  //    relation accepted/settled). Même filtres campagne/période que le
  //    reste : campaign_id + created_at (date d'envoi du message).
  let msgQuery = admin
    .from("pro_contact_actions")
    .select("email_opened_at, tracking_pixel_embedded")
    .eq("pro_account_id", proId)
    .eq("kind", "email_sent");
  if (campaignFilter) {
    msgQuery = msgQuery.eq("campaign_id", campaignFilter);
  }
  if (sinceIso) {
    msgQuery = msgQuery.gte("created_at", sinceIso);
  }
  const { data: msgRows, error: msgErr } = await msgQuery;
  if (msgErr) {
    console.error("[/api/pro/analytics] message opens read failed", msgErr);
  }
  const messageOpens = computeMessageOpenStats(
    ((msgRows ?? []) as Array<{ email_opened_at: string | null; tracking_pixel_embedded: boolean | null }>).map(
      (m) => ({ emailOpenedAt: m.email_opened_at, trackingPixelEmbedded: m.tracking_pixel_embedded }),
    ),
  );

  return NextResponse.json({
    acceptanceByTier, geoBreakdown, ageBreakdown, sexBreakdown,
    messageOpens,
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
