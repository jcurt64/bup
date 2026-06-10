/**
 * POST /api/prospect/freebuupps/[id]/join — le prospect s'inscrit à un FREEBUUPP.
 * Gardes : téléphone vérifié, campagne ouverte, panel non plein, pas déjà
 * inscrit, éligibilité géo. Attribue un numéro de participant séquentiel.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { canJoin } from "@/lib/freebuupp/eligibility";
import { isFreebuuppEnabled } from "@/lib/freebuupp/config";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();

  // Service livré désactivé : on refuse toute participation tant que le flag est off.
  if (!(await isFreebuuppEnabled(admin))) {
    return NextResponse.json({ error: "freebuupp_disabled" }, { status: 403 });
  }

  const { data: prospect } = await admin
    .from("prospects")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();
  if (!prospect) return NextResponse.json({ error: "no_prospect" }, { status: 404 });

  const { data: fb } = await admin
    .from("freebuupps")
    .select("id, status, closes_at, panel_size, geo, geo_target")
    .eq("id", id)
    .single();
  if (!fb) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const status =
    fb.status === "open" && new Date(fb.closes_at).getTime() <= Date.now() ? "closed" : fb.status;

  const { data: ident } = await admin
    .from("prospect_identity")
    .select("phone_verified_at")
    .eq("prospect_id", prospect.id)
    .maybeSingle();
  const phoneVerified = !!ident?.phone_verified_at;

  const { data: existing } = await admin
    .from("freebuupp_participants")
    .select("participant_number")
    .eq("freebuupp_id", id)
    .eq("prospect_id", prospect.id)
    .maybeSingle();
  const alreadyJoined = !!existing;

  const { count } = await admin
    .from("freebuupp_participants")
    .select("id", { count: "exact", head: true })
    .eq("freebuupp_id", id);
  const participantCount = count ?? 0;

  // TODO (Task 12b) : éligibilité géo réelle via la logique CP du matching
  // campagnes. Pour l'instant on accepte (national par défaut) — raccourci
  // documenté, à câbler avant activation du flag.
  const geoEligible = true;

  const decision = canJoin({
    status: status as "open",
    phoneVerified,
    alreadyJoined,
    participantCount,
    panelSize: fb.panel_size,
    geoEligible,
  });
  if (!decision.ok) {
    const code = decision.reason === "phone_unverified" ? 403 : 409;
    return NextResponse.json({ error: decision.reason }, { status: code });
  }

  const number = participantCount + 1;
  const { error } = await admin.from("freebuupp_participants").insert({
    freebuupp_id: id,
    prospect_id: prospect.id,
    participant_number: number,
  });
  if (error) {
    // 23505 = course (numéro/prospect déjà pris) → demander un retry au client.
    return NextResponse.json({ error: "conflict_retry" }, { status: 409 });
  }
  return NextResponse.json({ participantNumber: number });
}
