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
 *   1. On compte le nombre de "non_atteint" cumulés sur ce prospect
 *      (tous pros confondus).
 *   2. Si ≥ 2 ET qu'aucun event "prospect.non_atteint_threshold" n'a été
 *      émis pour ce prospect dans les 30 derniers jours, on :
 *      a. Récorde un admin_event (severity warning) → visible dans le feed
 *         live admin via SSE et dans la page Notifications.
 *      b. Crée un admin_broadcasts ciblé (target_clerk_user_id = ce
 *         prospect) avec un message gentil — il apparaîtra dans son
 *         onglet « Mes messages ».
 *   Le garde anti-spam évite de spammer l'admin/le prospect si le pro
 *   bascule plusieurs fois entre atteint et non_atteint.
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
import { recordEvent } from "@/lib/admin/events/record";

export const runtime = "nodejs";

const NON_ATTEINT_THRESHOLD = 2;
const ALERT_COOLDOWN_DAYS = 30;

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

  // Seul le passage à "non_atteint" déclenche la logique d'alerte.
  if (evalIn === "non_atteint") {
    await maybeTriggerAlert(admin, rel.prospect_id, relationId);
  }

  return NextResponse.json({ ok: true, evaluation: evalIn });
}

async function maybeTriggerAlert(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  prospectId: string,
  relationId: string,
): Promise<void> {
  // 1. Liste de toutes les "non_atteint" pour ce prospect (tous pros
  //    confondus) avec dates + raison sociale du pro qui a évalué. Cette
  //    info est snapshotée dans le payload de l'admin_event pour pouvoir
  //    rendre une UI riche sans refetcher au moment de l'affichage.
  const { data: flagRows, error: flagsErr } = await admin
    .from("relations")
    .select(
      `id, evaluated_at, evaluated_by_pro_id,
       pro_accounts:evaluated_by_pro_id ( raison_sociale )`,
    )
    .eq("prospect_id", prospectId)
    .eq("evaluation", "non_atteint")
    .order("evaluated_at", { ascending: false });
  if (flagsErr) {
    console.error("[evaluation/alert] flags lookup failed", flagsErr.message);
    return;
  }
  const flags = flagRows ?? [];
  const count = flags.length;
  if (count < NON_ATTEINT_THRESHOLD) return;

  // 2. Garde anti-spam : ne re-alerte pas si on l'a déjà fait récemment.
  const sinceIso = new Date(
    Date.now() - ALERT_COOLDOWN_DAYS * 86_400_000,
  ).toISOString();
  const { count: recentAlerts } = await admin
    .from("admin_events")
    .select("id", { count: "exact", head: true })
    .eq("type", "prospect.non_atteint_threshold")
    .eq("prospect_id", prospectId)
    .gte("created_at", sinceIso);
  if ((recentAlerts ?? 0) > 0) return;

  // 3. Récupère le clerk_user_id du prospect (pour cibler le broadcast).
  const { data: prospect } = await admin
    .from("prospects")
    .select("clerk_user_id")
    .eq("id", prospectId)
    .maybeSingle();
  const targetUserId = prospect?.clerk_user_id ?? null;

  // 4. Snapshot des pros (raison sociale + date du signalement) à
  //    embarquer dans le payload pour rendu UI riche côté admin.
  // Cast via `unknown` : le client supabase-js ne typifie pas l'embed
  // `pro_accounts:evaluated_by_pro_id` parce que la FK est récente.
  type ProRef = { raison_sociale: string | null } | { raison_sociale: string | null }[] | null;
  const proSnapshots = flags.map((r) => {
    const pa = (r as unknown as { pro_accounts: ProRef; evaluated_at: string | null }).pro_accounts;
    const proRow = Array.isArray(pa) ? pa[0] : pa;
    return {
      raisonSociale: proRow?.raison_sociale ?? "Pro anonyme",
      flaggedAt: r.evaluated_at,
    };
  });

  // 5. Admin event (visible dans le feed SSE + page Notifications).
  void recordEvent({
    type: "prospect.non_atteint_threshold",
    severity: "warning",
    prospectId,
    relationId,
    payload: {
      count,
      threshold: NON_ATTEINT_THRESHOLD,
      pros: proSnapshots,
    },
  });

  // 5. Broadcast ciblé au prospect concerné. Tonalité gentille et
  // pédagogique : on rappelle le pacte BUUPP sans culpabiliser.
  if (!targetUserId) return;
  const title = "Oups — un pro n'a pas pu vous joindre";
  const body =
    "Bonjour,\n\n" +
    "Il semblerait qu'un professionnel n'ait pas réussi à vous contacter " +
    "après votre acceptation. Pas de souci — un imprévu, ça arrive !\n\n" +
    "Petit rappel sur le fonctionnement de BUUPP : quand vous acceptez " +
    "une sollicitation, le professionnel paie pour pouvoir vous joindre, " +
    "et vous touchez votre rémunération. C'est un échange qui marche " +
    "dans les deux sens — le pro développe son activité, et vous " +
    "valorisez vos données.\n\n" +
    "À l'avenir, pensez à répondre aux sollicitations que vous avez " +
    "acceptées (par email, SMS, ou téléphone) — même un simple « non " +
    "merci » est mieux qu'un silence. Cela permet au professionnel de " +
    "passer à autre chose, et garantit que BUUPP reste un service " +
    "agréable pour tout le monde.\n\n" +
    "Merci de votre attention,\n" +
    "L'équipe BUUPP";
  const { error: bcErr } = await admin.from("admin_broadcasts").insert({
    title,
    body,
    audience: "prospects",
    created_by_admin_id: "system:non-atteint-auto",
    target_clerk_user_id: targetUserId,
  });
  if (bcErr) {
    console.error(
      `[evaluation/alert] targeted broadcast failed → code=${bcErr.code} message=${bcErr.message}`,
    );
  }
}
