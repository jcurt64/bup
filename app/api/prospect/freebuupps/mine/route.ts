/**
 * GET /api/prospect/freebuupps/mine — les participations du prospect courant
 * avec leur résultat (en cours / perdu / gagné).
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
  if (!prospect) return NextResponse.json({ participations: [] });

  const { data: parts } = await admin
    .from("freebuupp_participants")
    .select("freebuupp_id, participant_number, is_winner, prize_reported_at, created_at")
    .eq("prospect_id", prospect.id)
    .order("created_at", { ascending: false });

  const ids = (parts ?? []).map((p) => p.freebuupp_id);
  const fbById = new Map<
    string,
    { code: string; auth_code: string | null; title: string; brand_name: string; status: string; closes_at: string; drawn_at: string | null }
  >();
  if (ids.length > 0) {
    const { data: fbs } = await admin
      .from("freebuupps")
      .select("id, code, auth_code, title, brand_name, status, closes_at, drawn_at")
      .in("id", ids);
    for (const f of fbs ?? []) {
      fbById.set(f.id, {
        code: f.code,
        auth_code: f.auth_code,
        title: f.title,
        brand_name: f.brand_name,
        status: f.status,
        closes_at: f.closes_at,
        drawn_at: f.drawn_at,
      });
    }
  }

  const participations = (parts ?? []).map((p) => {
    const fb = fbById.get(p.freebuupp_id);
    const drawn = fb?.status === "drawn" || fb?.status === "canceled";
    return {
      freebuuppId: p.freebuupp_id,
      code: fb?.code ?? null,
      title: fb?.title ?? null,
      brandName: fb?.brand_name ?? null,
      participantNumber: p.participant_number,
      status: fb?.status ?? "open",
      closesAt: fb?.closes_at ?? null,
      drawnAt: fb?.drawn_at ?? null,
      result: !drawn ? "pending" : p.is_winner ? "won" : "lost",
      prizeReported: !!p.prize_reported_at,
      // Code d'authentification : révélé UNIQUEMENT au gagnant, pour vérifier
      // l'identité du pro qui le contacte. Jamais pour les perdants/public.
      authCode: p.is_winner && drawn ? (fb?.auth_code ?? null) : null,
    };
  });

  return NextResponse.json({ participations });
}
