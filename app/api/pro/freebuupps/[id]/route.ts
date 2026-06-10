/**
 * GET /api/pro/freebuupps/[id] — détail d'un FREEBUUPP du pro.
 * Si `status='drawn'`, expose les gagnants = { participantNumber, telephone }
 * (révélation limitée au téléphone, lu dans prospect_identity).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { sweepDueFreebuupps } from "@/lib/freebuupp/lifecycle";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  const admin = createSupabaseAdminClient();
  // Tirage automatique paresseux avant lecture (clôture échue / panel plein).
  await sweepDueFreebuupps(admin);

  const { data: fb } = await admin
    .from("freebuupps")
    .select(
      "id, code, title, prize_description, panel_size, winners_count, status, opens_at, closes_at, drawn_at, seed, seed_hash, geo, consolation_sent_at",
    )
    .eq("id", id)
    .eq("pro_account_id", proId)
    .single();
  if (!fb) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: parts } = await admin
    .from("freebuupp_participants")
    .select("participant_number, is_winner, prospect_id, prize_reported_at, prize_report_reason")
    .eq("freebuupp_id", id)
    .order("participant_number");

  let winners: {
    participantNumber: number;
    telephone: string | null;
    prizeReported: boolean;
    prizeReportReason: string | null;
  }[] = [];
  if (fb.status === "drawn") {
    const winnerRows = (parts ?? []).filter((p) => p.is_winner);
    const pids = winnerRows.map((w) => w.prospect_id);
    const phoneByProspect = new Map<string, string | null>();
    if (pids.length > 0) {
      const { data: idents } = await admin
        .from("prospect_identity")
        .select("prospect_id, telephone")
        .in("prospect_id", pids);
      for (const it of idents ?? []) phoneByProspect.set(it.prospect_id, it.telephone ?? null);
    }
    winners = winnerRows.map((w) => ({
      participantNumber: w.participant_number,
      telephone: phoneByProspect.get(w.prospect_id) ?? null,
      prizeReported: !!w.prize_reported_at,
      prizeReportReason: w.prize_report_reason ?? null,
    }));
  }

  const now = Date.now();
  const effectiveStatus =
    fb.status === "open" && new Date(fb.closes_at).getTime() <= now ? "closed" : fb.status;

  return NextResponse.json({
    freebuupp: {
      id: fb.id,
      code: fb.code,
      title: fb.title,
      prizeDescription: fb.prize_description,
      panelSize: fb.panel_size,
      winnersCount: fb.winners_count,
      status: fb.status,
      effectiveStatus,
      opensAt: fb.opens_at,
      closesAt: fb.closes_at,
      drawnAt: fb.drawn_at,
      seedHash: fb.seed_hash,
      seed: fb.status === "drawn" ? fb.seed : null,
      geo: fb.geo,
      consolationSent: !!fb.consolation_sent_at,
      participantCount: parts?.length ?? 0,
      winners,
    },
  });
}
