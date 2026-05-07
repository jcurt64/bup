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
    .select("plan, monthly_cents, max_prospects, max_campaigns");

  const out: Record<
    Plan,
    {
      label: string;
      monthlyEur: number;
      monthlyCents: number;
      maxProspects: number;
      maxCampaigns: number;
    }
  > = {
    starter: { label: "Starter", monthlyEur: 0, monthlyCents: 0, maxProspects: 0, maxCampaigns: 2 },
    pro: { label: "Pro", monthlyEur: 0, monthlyCents: 0, maxProspects: 0, maxCampaigns: 10 },
  };
  for (const r of (data ?? []) as Array<{
    plan: Plan;
    monthly_cents: number;
    max_prospects: number;
    max_campaigns: number;
  }>) {
    const plan = r.plan;
    if (plan === "starter" || plan === "pro") {
      const cents = Number(r.monthly_cents);
      out[plan] = {
        label: LABELS[plan],
        monthlyCents: cents,
        monthlyEur: Math.round(cents) / 100,
        maxProspects: Number(r.max_prospects),
        maxCampaigns: Number(r.max_campaigns),
      };
    }
  }
  return NextResponse.json(out);
}
