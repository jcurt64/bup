/**
 * GET /api/freebuupps — PUBLIC (sans auth). Mur des FREEBUUPP :
 * tirages en cours (open, non expirés) + tirages récents (drawn).
 * Aucune donnée personnelle — uniquement marque, lot, et numéros.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const RECENT_DRAWN_CAP = 50;

export async function GET() {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const [openRes, drawnRes] = await Promise.all([
    admin
      .from("freebuupps")
      .select("id, code, title, prize_description, brand_name, panel_size, winners_count, geo, opens_at, closes_at")
      .eq("status", "open")
      .gt("closes_at", nowIso)
      .order("closes_at", { ascending: true }),
    admin
      .from("freebuupps")
      .select("id, code, title, prize_description, brand_name, panel_size, winners_count, geo, drawn_at")
      .eq("status", "drawn")
      .order("drawn_at", { ascending: false })
      .limit(RECENT_DRAWN_CAP),
  ]);

  const allIds = [
    ...(openRes.data ?? []).map((r) => r.id),
    ...(drawnRes.data ?? []).map((r) => r.id),
  ];
  const counts = new Map<string, number>();
  if (allIds.length > 0) {
    const { data: parts } = await admin
      .from("freebuupp_participants")
      .select("freebuupp_id")
      .in("freebuupp_id", allIds);
    for (const p of parts ?? []) counts.set(p.freebuupp_id, (counts.get(p.freebuupp_id) ?? 0) + 1);
  }

  const ongoing = (openRes.data ?? []).map((r) => ({
    code: r.code,
    title: r.title,
    prizeDescription: r.prize_description,
    brandName: r.brand_name,
    panelSize: r.panel_size,
    winnersCount: r.winners_count,
    geo: r.geo,
    closesAt: r.closes_at,
    participantCount: counts.get(r.id) ?? 0,
    placesLeft: Math.max(0, r.panel_size - (counts.get(r.id) ?? 0)),
  }));

  const past = (drawnRes.data ?? []).map((r) => ({
    code: r.code,
    title: r.title,
    prizeDescription: r.prize_description,
    brandName: r.brand_name,
    panelSize: r.panel_size,
    winnersCount: r.winners_count,
    geo: r.geo,
    drawnAt: r.drawn_at,
    participantCount: counts.get(r.id) ?? 0,
  }));

  return NextResponse.json({ ongoing, past });
}
