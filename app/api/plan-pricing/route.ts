/**
 * GET /api/plan-pricing — endpoint PUBLIC (sans auth) qui expose la
 * tarification des plans Starter / Pro pour alimenter la section
 * "Pricing" de la page d'accueil.
 *
 * Source : table `plan_pricing` (lecture autorisée pour les rôles
 * `anon` et `authenticated` via la policy `plan_pricing_read_all`).
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Plan = "starter" | "pro";
const LABELS: Record<Plan, string> = { starter: "Starter", pro: "Pro" };

export async function GET() {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("plan_pricing")
    .select("plan, monthly_cents, max_prospects");

  const out: Record<
    Plan,
    { label: string; monthlyEur: number; monthlyCents: number; maxProspects: number }
  > = {
    starter: { label: "Starter", monthlyEur: 0, monthlyCents: 0, maxProspects: 0 },
    pro: { label: "Pro", monthlyEur: 0, monthlyCents: 0, maxProspects: 0 },
  };
  for (const r of data ?? []) {
    const plan = r.plan as Plan;
    if (plan === "starter" || plan === "pro") {
      const cents = Number(r.monthly_cents);
      out[plan] = {
        label: LABELS[plan],
        monthlyCents: cents,
        monthlyEur: Math.round(cents) / 100,
        maxProspects: Number(r.max_prospects),
      };
    }
  }
  return NextResponse.json(out);
}
