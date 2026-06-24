/**
 * POST /api/pro/contacts/[relationId]/priority
 * Body : { priority: 1 | 2 | 3 | null }
 *
 * Le pro classe une fiche prospect par priorité de traitement depuis la
 * fiche détaillée (popup « Voir détails ») :
 *   1 = Haute   ·  2 = Moyenne  ·  3 = Basse  ·  null = non définie (reset)
 *
 * Permet ensuite au pro de filtrer/trier ses prospects et d'organiser ses
 * relances. La priorité est propre au pro propriétaire de la relation.
 *
 * 200 → { ok: true, priority, fiabiliteAgg } (agrégat cross-pro rafraîchi)
 * 400 → body invalide
 * 401 → non authentifié
 * 403 → relation introuvable / wrong pro / status hors accepted|settled
 */

import { after, NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import {
  computeAndPersistProspectScore,
  computeFiabiliteAgg,
  type FiabiliteAgg,
} from "@/lib/prospect/score";

export const runtime = "nodejs";

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

  let body: { priority?: unknown };
  try {
    body = (await req.json()) as { priority?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const raw = body?.priority;
  const priority =
    raw === null ? null : typeof raw === "number" ? raw : NaN;
  if (priority !== null && ![1, 2, 3].includes(priority)) {
    return NextResponse.json({ error: "invalid_priority" }, { status: 400 });
  }

  const user = await currentUser();
  const userEmail =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email: userEmail });

  const admin = createSupabaseAdminClient();

  // Vérif ownership + statut éligible (relation acceptée/réglée du pro courant).
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

  const { error: upErr } = await admin
    .from("relations")
    .update({ pro_priority: priority })
    .eq("id", relationId);
  if (upErr) {
    console.error(
      `[/api/pro/contacts/${relationId}/priority] update failed → code=${upErr.code} message=${upErr.message}`,
    );
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // La note pro alimente la FIABILITÉ agrégée du prospect (indice de
  // désirabilité + filtre de ciblage). On renvoie l'agrégat cross-pro FRAIS
  // (calculé après l'UPDATE committé) pour que le client rafraîchisse les
  // badges « N » par niveau sans recharger la liste, puis on recalcule le score
  // dénormalisé (plus lourd) en tâche de fond.
  let fiabiliteAgg: FiabiliteAgg | null = null;
  if (rel.prospect_id) {
    const prospectId = rel.prospect_id as string;
    fiabiliteAgg = await computeFiabiliteAgg(admin, prospectId);
    after(async () => {
      try {
        await computeAndPersistProspectScore(admin, prospectId);
      } catch (e) {
        console.error("[priority] recompute fiabilité failed", e);
      }
    });
  }

  return NextResponse.json({ ok: true, priority, fiabiliteAgg });
}
