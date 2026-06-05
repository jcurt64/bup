/**
 * POST /api/pro/contacts/[relationId]/evaluation
 * Body : { evaluation: "atteint" | "non_atteint" | null }
 *
 * Le pro évalue une relation acceptée/settled après tentative de contact :
 *   - "atteint"     : prospect contacté, échange constructif
 *   - "non_atteint" : prospect injoignable (pas de réponse aux sollicitations)
 *   - null          : reset (le pro veut ré-évaluer plus tard)
 *
 * Conséquences automatiques quand la nouvelle valeur est "non_atteint" :
 *   On compte un "strike" (1 contact = 1 fois, via relations.non_atteint_counted)
 *   puis on délègue l'escalade à lib/prospect/non-response.ts :
 *     2 strikes → signalement (admin event + rappel courtois)
 *     3 strikes → malus BUUPP Score (-100 pts) + message courtois
 *     4 strikes → restriction d'acceptation 2 mois + message courtois
 *   Le flag non_atteint_counted garantit qu'un re-basculement atteint↔non
 *   atteint sur le même contact ne recompte pas un strike.
 *
 * 200 → { ok: true, evaluation }
 * 400 → body invalide
 * 401 → non authentifié
 * 403 → relation introuvable / wrong pro / status hors accepted|settled
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { applyNonResponseEscalation } from "@/lib/prospect/non-response";

export const runtime = "nodejs";

type Evaluation = "atteint" | "non_atteint";
type RouteContext = { params: Promise<{ relationId: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { relationId } = await ctx.params;
  if (!relationId) {
    return NextResponse.json({ error: "missing_relation_id" }, { status: 400 });
  }

  let body: { evaluation?: Evaluation | null };
  try {
    body = (await req.json()) as { evaluation?: Evaluation | null };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const evalIn = body?.evaluation;
  if (evalIn !== "atteint" && evalIn !== "non_atteint" && evalIn !== null) {
    return NextResponse.json({ error: "invalid_evaluation" }, { status: 400 });
  }

  const user = await currentUser();
  const userEmail =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email: userEmail });

  const admin = createSupabaseAdminClient();

  // Vérif ownership + statut éligible.
  const { data: rel } = await admin
    .from("relations")
    .select("id, pro_account_id, prospect_id, status")
    .eq("id", relationId)
    .maybeSingle();

  if (!rel || rel.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (rel.status !== "accepted" && rel.status !== "settled") {
    return NextResponse.json({ error: "invalid_status" }, { status: 403 });
  }

  // UPDATE atomique de l'évaluation. evaluated_at + evaluated_by_pro_id
  // remis à null si on reset (evaluation = null).
  const { error: upErr } = await admin
    .from("relations")
    .update({
      evaluation: evalIn,
      evaluated_at: evalIn === null ? null : new Date().toISOString(),
      evaluated_by_pro_id: evalIn === null ? null : proId,
    })
    .eq("id", relationId);
  if (upErr) {
    console.error(
      `[/api/pro/contacts/${relationId}/evaluation] update failed → code=${upErr.code} message=${upErr.message}`,
    );
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // Seul le passage à "non_atteint" compte un strike. Dédup atomique : on ne
  // flippe non_atteint_counted false→true qu'une fois par contact (le `returning`
  // ne renvoie une ligne que pour le tout premier passage), ce qui évite de
  // recompter si le pro bascule plusieurs fois atteint↔non atteint.
  if (evalIn === "non_atteint") {
    const { data: counted } = await admin
      .from("relations")
      .update({ non_atteint_counted: true })
      .eq("id", relationId)
      .eq("non_atteint_counted", false)
      .select("id");
    if (counted && counted.length > 0) {
      // Nouveau strike : incrément (read-modify-write — fréquence très faible,
      // le flag counted garantit déjà l'absence de double comptage par contact).
      const { data: cur } = await admin
        .from("prospects")
        .select("non_response_strikes")
        .eq("id", rel.prospect_id)
        .maybeSingle();
      const next = (cur?.non_response_strikes ?? 0) + 1;
      await admin
        .from("prospects")
        .update({ non_response_strikes: next })
        .eq("id", rel.prospect_id);
      await applyNonResponseEscalation(admin, rel.prospect_id, relationId);
    }
  }

  return NextResponse.json({ ok: true, evaluation: evalIn });
}
