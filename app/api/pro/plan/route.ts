/**
 * /api/pro/plan — formule tarifaire du compte pro.
 *
 * Depuis novembre 2026 : FORMULE UNIQUE. Plus de frais d'accès Starter/Pro,
 * campagnes illimitées, 5 paliers ouverts. Seule la commission BUUPP
 * s'applique (10 % de la rémunération prospect, min. 0,30 € par acceptation).
 *
 * L'endpoint est CONSERVÉ pour les builds mobiles déjà publiés qui l'appellent
 * encore : il renvoie toujours la même formule (plan « pro », 0 €, aucun
 * plafond) et le POST est un no-op.
 *
 *   GET  → { plan, label, monthlyEur: 0, maxCampaigns, capReached: false, commission, specs }
 *   POST → idem (ignore le plan demandé)
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { singlePlanPayload } from "@/lib/pricing/single-plan";

export const runtime = "nodejs";

function payload() {
  const spec = singlePlanPayload();
  return {
    plan: "pro" as const,
    ...spec,
    // Les deux clés restent présentes pour les anciens clients.
    specs: { starter: spec, pro: spec },
    cycleCount: 0,
    cap: spec.maxCampaigns,
    capReached: false,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(payload());
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...payload() });
}
