/**
 * GET /api/freebuupps/[code] — PUBLIC (sans auth). Détail d'un FREEBUUPP :
 * marque, lot, liste publique des numéros de participants, et — si tiré —
 * les numéros gagnants + le seed révélé (tirage vérifiable). Aucune donnée
 * personnelle exposée.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const admin = createSupabaseAdminClient();

  const { data: fb } = await admin
    .from("freebuupps")
    .select(
      "id, code, title, prize_description, brand_name, panel_size, winners_count, status, geo, opens_at, closes_at, drawn_at, seed, seed_hash",
    )
    .eq("code", code)
    .single();
  if (!fb) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: parts } = await admin
    .from("freebuupp_participants")
    .select("participant_number, is_winner")
    .eq("freebuupp_id", fb.id)
    .order("participant_number");

  const isDrawn = fb.status === "drawn";
  const participantNumbers = (parts ?? []).map((p) => p.participant_number);
  const winningNumbers = isDrawn
    ? (parts ?? []).filter((p) => p.is_winner).map((p) => p.participant_number)
    : [];

  return NextResponse.json({
    freebuupp: {
      code: fb.code,
      title: fb.title,
      prizeDescription: fb.prize_description,
      brandName: fb.brand_name,
      panelSize: fb.panel_size,
      winnersCount: fb.winners_count,
      status: fb.status,
      geo: fb.geo,
      opensAt: fb.opens_at,
      closesAt: fb.closes_at,
      drawnAt: fb.drawn_at,
      participantCount: participantNumbers.length,
      participantNumbers,
      winningNumbers,
      // Vérifiable : seed_hash publié dès l'ouverture, seed révélé au tirage.
      seedHash: fb.seed_hash,
      seed: isDrawn ? fb.seed : null,
    },
  });
}
