/**
 * /api/pro/plan — gestion du plan tarifaire du compte pro.
 *
 *   GET    → { plan, label, maxProspects, monthlyEur, specs }
 *   POST   → body { plan: "starter" | "pro" } → met à jour `pro_accounts.plan`.
 *
 * Source de vérité des prix et caps : la table `plan_pricing` côté
 * Supabase. Modifier un prix = simple UPDATE en base, sans toucher au
 * code. La page d'accueil consomme aussi cette source via /api/plan-pricing.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

type Plan = "starter" | "pro";
const LABELS: Record<Plan, string> = { starter: "Starter", pro: "Pro" };

type PriceRow = { plan: Plan; monthly_cents: number; max_prospects: number };

async function loadPricing() {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("plan_pricing")
    .select("plan, monthly_cents, max_prospects");
  const rows = (data ?? []) as PriceRow[];
  const specs: Record<
    Plan,
    { label: string; monthlyEur: number; monthlyCents: number; maxProspects: number }
  > = {
    starter: { label: "Starter", monthlyEur: 0, monthlyCents: 0, maxProspects: 0 },
    pro: { label: "Pro", monthlyEur: 0, monthlyCents: 0, maxProspects: 0 },
  };
  for (const r of rows) {
    if (r.plan === "starter" || r.plan === "pro") {
      specs[r.plan] = {
        label: LABELS[r.plan],
        monthlyCents: Number(r.monthly_cents),
        monthlyEur: Math.round(Number(r.monthly_cents)) / 100,
        maxProspects: Number(r.max_prospects),
      };
    }
  }
  return specs;
}

async function getProId(userId: string): Promise<string> {
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  return ensureProAccount({ clerkUserId: userId, email });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const proId = await getProId(userId);
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("pro_accounts")
    .select("plan")
    .eq("id", proId)
    .single();
  const plan: Plan = (data?.plan as Plan) ?? "starter";
  const specs = await loadPricing();
  return NextResponse.json({
    plan,
    ...specs[plan],
    specs,
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  if (body.plan !== "starter" && body.plan !== "pro") {
    return NextResponse.json(
      { error: "invalid_plan", message: "plan must be 'starter' or 'pro'" },
      { status: 400 },
    );
  }
  const plan: Plan = body.plan;
  const proId = await getProId(userId);
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pro_accounts")
    .update({ plan })
    .eq("id", proId);
  if (error) {
    console.error("[/api/pro/plan POST] update error:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  const specs = await loadPricing();
  return NextResponse.json({
    ok: true,
    plan,
    ...specs[plan],
    specs,
  });
}
