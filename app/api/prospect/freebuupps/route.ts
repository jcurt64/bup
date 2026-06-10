/**
 * GET /api/prospect/freebuupps — feed des FREEBUUPP ouverts pour le prospect
 * courant : marque, lot, places restantes, compte à rebours, et flag
 * `alreadyJoined` (+ son numéro de participant le cas échéant).
 *
 * Éligibilité géo : raccourci `national` au lancement (cf. Task 12b).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sweepDueFreebuupps } from "@/lib/freebuupp/lifecycle";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();
  // Tirage automatique paresseux avant lecture (clôture échue / panel plein).
  await sweepDueFreebuupps(admin);

  const { data: prospect } = await admin
    .from("prospects")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const { data: rows } = await admin
    .from("freebuupps")
    .select(
      "id, code, title, prize_description, brand_name, panel_size, winners_count, geo, opens_at, closes_at",
    )
    .eq("status", "open")
    .gt("closes_at", nowIso)
    .order("closes_at", { ascending: true });

  const ids = (rows ?? []).map((r) => r.id);
  const counts = new Map<string, number>();
  const myNumber = new Map<string, number>();
  if (ids.length > 0) {
    const { data: parts } = await admin
      .from("freebuupp_participants")
      .select("freebuupp_id, prospect_id, participant_number")
      .in("freebuupp_id", ids);
    for (const p of parts ?? []) {
      counts.set(p.freebuupp_id, (counts.get(p.freebuupp_id) ?? 0) + 1);
      if (prospect && p.prospect_id === prospect.id) {
        myNumber.set(p.freebuupp_id, p.participant_number);
      }
    }
  }

  const freebuupps = (rows ?? [])
    .map((r) => {
      const count = counts.get(r.id) ?? 0;
      return {
        id: r.id,
        code: r.code,
        title: r.title,
        prizeDescription: r.prize_description,
        brandName: r.brand_name,
        panelSize: r.panel_size,
        winnersCount: r.winners_count,
        geo: r.geo,
        opensAt: r.opens_at,
        closesAt: r.closes_at,
        participantCount: count,
        placesLeft: Math.max(0, r.panel_size - count),
        alreadyJoined: myNumber.has(r.id),
        myNumber: myNumber.get(r.id) ?? null,
      };
    })
    // On masque les panels déjà pleins (sauf si le prospect y est inscrit).
    .filter((f) => f.placesLeft > 0 || f.alreadyJoined);

  return NextResponse.json({ freebuupps });
}
