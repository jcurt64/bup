/**
 * POST /api/prospect/freebuupps/[id]/report — un GAGNANT signale la
 * non-réception de son lot. Gardes : flag actif, le prospect est bien
 * gagnant de ce FREEBUUPP, pas déjà signalé. Enregistre le signalement
 * + un event admin pour suivi.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isFreebuuppEnabled } from "@/lib/freebuupp/config";
import { recordEvent } from "@/lib/admin/events/record";

export const runtime = "nodejs";

const MAX_REASON = 500;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { reason?: string };
  try {
    body = (await req.json().catch(() => ({}))) as { reason?: string };
  } catch {
    body = {};
  }
  const reason = (body.reason ?? "").trim().slice(0, MAX_REASON) || null;

  const admin = createSupabaseAdminClient();
  if (!(await isFreebuuppEnabled(admin))) {
    return NextResponse.json({ error: "freebuupp_disabled" }, { status: 403 });
  }

  const { data: prospect } = await admin
    .from("prospects")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();
  if (!prospect) return NextResponse.json({ error: "no_prospect" }, { status: 404 });

  const { data: part } = await admin
    .from("freebuupp_participants")
    .select("id, is_winner, prize_reported_at, participant_number")
    .eq("freebuupp_id", id)
    .eq("prospect_id", prospect.id)
    .maybeSingle();
  if (!part) return NextResponse.json({ error: "not_participant" }, { status: 404 });
  if (!part.is_winner) return NextResponse.json({ error: "not_winner" }, { status: 403 });
  if (part.prize_reported_at) return NextResponse.json({ error: "already_reported" }, { status: 409 });

  const { error } = await admin
    .from("freebuupp_participants")
    .update({ prize_reported_at: new Date().toISOString(), prize_report_reason: reason })
    .eq("id", part.id);
  if (error) {
    console.error("[freebuupp/report] update failed", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // Suivi admin : remonte le signalement pour traitement.
  void (async () => {
    try {
      const { data: fb } = await admin
        .from("freebuupps")
        .select("code, title, brand_name, pro_account_id")
        .eq("id", id)
        .single();
      await recordEvent({
        type: "freebuupp.prize_not_received",
        severity: "warning",
        payload: {
          freebuuppId: id,
          code: fb?.code ?? null,
          title: fb?.title ?? null,
          brand: fb?.brand_name ?? null,
          proAccountId: fb?.pro_account_id ?? null,
          participantNumber: part.participant_number,
          reason,
        },
      });
    } catch (e) {
      console.error("[freebuupp/report] recordEvent failed", e);
    }
  })();

  return NextResponse.json({ ok: true });
}
