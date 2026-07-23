/**
 * POST /api/admin/founder-bonus/distribute — PROVISIONNE le bonus fondateur
 * 5 € aux prospects éligibles (is_founder, sans ligne de bonus).
 *
 * Le bonus est écrit en `pending` : il ne devient disponible et retirable
 * qu'une fois les conditions de déblocage réunies (3 mois d'ancienneté du
 * compte + au moins une sollicitation acceptée). Cf. lib/founder-bonus/sync.ts.
 * Cet endpoint ne distribue donc plus rien : il ne fait que provisionner, et
 * n'envoie aucune notification — celles-ci partent au déblocage.
 *
 *   ?confirm=1 → provisionnement RÉEL.
 *   sinon       → dry-run : renvoie seulement { eligible } sans rien écrire.
 *
 * Garde : admin (session Clerk allowlistée OU x-admin-secret), via
 * requireAdminRequest. Idempotent : re-jouer ne double-provisionne personne.
 *
 * ⚠️ Endpoint destiné à un déclenchement CLI/curl (ou bouton back-office
 * admin) UNIQUEMENT. Ne PAS le câbler à un bouton front public sans ajouter
 * un durcissement CSRF (jeton dans le body) : le `?confirm=1` en query suffit
 * aujourd'hui car l'usage est manuel, admin-only et gated par un dry-run.
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { provisionFounderBonuses } from "@/lib/founder-bonus/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const confirm = new URL(req.url).searchParams.get("confirm") === "1";
  const admin = createSupabaseAdminClient();

  try {
    const result = await provisionFounderBonuses(admin, { confirm });
    return NextResponse.json({ dryRun: !confirm, ...result });
  } catch (err) {
    // Cohérence avec les autres routes admin : on log + renvoie un JSON
    // d'erreur actionnable plutôt qu'un 500 nu (l'opérateur lit la sortie).
    console.error("[/api/admin/founder-bonus/distribute] failed", err);
    return NextResponse.json(
      { error: "distribute_failed", detail: String(err) },
      { status: 500 },
    );
  }
}
