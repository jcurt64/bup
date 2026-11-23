/**
 * POST /api/pro/contacts/[relationId]/validate
 * Body : { validated: boolean }
 *
 * Le pro confirme (ou annule) que la mise en relation a été EFFECTIVE :
 * appel abouti, e-mail suivi d'un échange, réponse à son étude / sondage…
 * Une validation fait passer le prospect au niveau « certifié confiance »
 * (cf. lib/prospect/verification-tier).
 *
 * Garde-fous (identiques à la fiche détails) : relation du pro courant,
 * status ∈ {accepted, settled}, campagne clôturée (proCanSeeContacts).
 * Une validation positive marque aussi la relation « atteint » si elle
 * n'était pas encore évaluée (cohérence avec la colonne Évaluation).
 *
 * 200 → { ok: true, validatedAt, prospectTier }
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";
import { recomputeVerificationTier } from "@/lib/prospect/verification-tier";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ relationId: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { relationId } = await ctx.params;
  if (!relationId) return NextResponse.json({ error: "missing_relation_id" }, { status: 400 });

  let body: { validated?: unknown };
  try {
    body = (await req.json()) as { validated?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof body?.validated !== "boolean") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const validated = body.validated;

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("relations")
    .select("id, pro_account_id, prospect_id, status, evaluation, campaigns ( status )")
    .eq("id", relationId)
    .maybeSingle();
  type Row = {
    id: string;
    pro_account_id: string;
    prospect_id: string;
    status: string;
    evaluation: string | null;
    campaigns: { status: string } | { status: string }[] | null;
  };
  const rel = data as unknown as Row | null;
  if (!rel || rel.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (rel.status !== "accepted" && rel.status !== "settled") {
    return NextResponse.json({ error: "invalid_status" }, { status: 403 });
  }
  const camp = Array.isArray(rel.campaigns) ? rel.campaigns[0] : rel.campaigns;
  if (!proCanSeeContacts(camp?.status)) {
    return NextResponse.json({ error: "campaign_not_closed" }, { status: 403 });
  }

  const validatedAt = validated ? new Date().toISOString() : null;
  const patch: { pro_validated_at: string | null; evaluation?: "atteint"; evaluated_at?: string; evaluated_by_pro_id?: string } = {
    pro_validated_at: validatedAt,
  };
  if (validated && !rel.evaluation) {
    patch.evaluation = "atteint";
    patch.evaluated_at = validatedAt!;
    patch.evaluated_by_pro_id = proId;
  }
  const { error: upErr } = await admin.from("relations").update(patch).eq("id", relationId);
  if (upErr) {
    console.error(`[/api/pro/contacts/${relationId}/validate] update failed`, upErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  const { tier } = await recomputeVerificationTier(admin, rel.prospect_id);
  return NextResponse.json({
    ok: true,
    validatedAt,
    evaluation: patch.evaluation ?? rel.evaluation,
    prospectTier: tier,
  });
}
