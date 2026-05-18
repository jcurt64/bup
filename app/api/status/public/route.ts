/**
 * GET /api/status/public — état temps réel ASSAINI (public, sans auth).
 *
 * Volontairement minimal : `{ overall, components:[{id,name,status}] }`.
 * AUCUN détail interne (pas de `message`, pas de `latencyMs`, pas de nom
 * de variable d'environnement, pas d'erreur brute) — principe de moindre
 * divulgation : un visiteur anonyme ne doit pas pouvoir cartographier la
 * stack ni découvrir une mauvaise configuration.
 *
 * Dérive du MÊME calcul que `/api/status` (lib/status/checks) : pas de
 * divergence possible entre la vue interne et la vue publique.
 *
 * Déclarée publique dans proxy.ts (isPublicRoute).
 */
import { NextResponse } from "next/server";
import { runStatusChecks, aggregate, sanitize } from "@/lib/status/checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const detailed = await runStatusChecks();
  return NextResponse.json(
    {
      overall: aggregate(detailed),
      components: detailed.map(sanitize),
      checkedAt: new Date().toISOString(),
    },
    { headers: { "cache-control": "public, max-age=15, s-maxage=15" } },
  );
}
