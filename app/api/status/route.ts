/**
 * GET /api/status — état temps réel DÉTAILLÉ (authentifié).
 *
 * Route NON publique (cf. proxy.ts) : la réponse contient des
 * diagnostics internes (messages d'erreur bruts, latence, noms des
 * variables d'environnement manquantes). Réservée aux sessions
 * authentifiées / back-office.
 *
 * Pour un statut consultable sans authentification (page publique,
 * sonde uptime), utiliser `GET /api/status/public` (assaini).
 *
 * Format : { overall, components:[{id,name,status,latencyMs?,message?}], checkedAt }
 */
import { NextResponse } from "next/server";
import { runStatusChecks, aggregate } from "@/lib/status/checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const components = await runStatusChecks();
  return NextResponse.json({
    overall: aggregate(components),
    components,
    checkedAt: new Date().toISOString(),
  });
}
