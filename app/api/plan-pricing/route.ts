/**
 * GET /api/plan-pricing — endpoint PUBLIC (sans auth) : tarification BUUPP.
 *
 * Depuis novembre 2026 : formule unique, sans frais d'accès. Seule la
 * commission par acceptation s'applique (10 %, min. 0,30 €). Les clés
 * `starter` / `pro` sont conservées (même contenu) pour les anciens clients.
 */
import { NextResponse } from "next/server";
import { singlePlanPayload } from "@/lib/pricing/single-plan";

export const runtime = "nodejs";

export async function GET() {
  const spec = singlePlanPayload();
  return NextResponse.json({ starter: spec, pro: spec, single: spec });
}
