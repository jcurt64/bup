/**
 * POST /api/pro/campaigns — lance une campagne et notifie les prospects matchants.
 *
 * Algorithme (cf. spec §2 / §3) :
 *  1. ensureProAccount + lecture wallet + frais plan.
 *  2. Vérification solde ≥ budget + plan_fee → sinon 402.
 *  3. INSERT campaigns(active, brief, starts_at, ends_at).
 *  4. findMatchingProspects(LIMIT contacts).
 *  5. Batch INSERT relations(pending, expires_at = now()+EXPIRY_MINUTES).
 *  6. Update campaigns.matched_count.
 *  7. Fire-and-forget : sendRelationInvitation par prospect avec email.
 *
 * Service_role obligatoire — la requête de matching croise plusieurs
 * prospects (RLS bloquerait la lecture).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { findMatchingProspects } from "@/lib/campaigns/matching";
import {
  objectiveLabel,
  objectiveToCampaignType,
  tierNumsToKeys,
} from "@/lib/campaigns/mapping";
import { sendRelationInvitation } from "@/lib/email/relation";

export const runtime = "nodejs";

type Body = {
  name?: string;
  objectiveId: string;
  subTypes: string[];
  requiredTiers: number[];
  geo: string;
  ages: string[];
  verifLevel: string;
  contacts: number;
  days: number;
  startDate: string;
  endDate: string;
  brief: string;
  costPerContactCents: number;
  budgetCents: number;
  keywords: string[];
  kwFilter: boolean;
  poolMode: string;
};

// TEST : durée de validité réduite à 1 minute pour vérifier le flux
// d'expiration. Valeur produit nominale = 72 h (4320 min). À restaurer
// avant mise en prod.
const EXPIRY_MINUTES = 1;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    !body.objectiveId ||
    !Array.isArray(body.requiredTiers) || body.requiredTiers.length === 0 ||
    !body.brief || body.brief.trim().length === 0 ||
    !body.contacts || body.contacts < 1 ||
    !body.costPerContactCents || body.costPerContactCents < 1 ||
    !body.budgetCents || body.budgetCents < 1
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const startTs = new Date(body.startDate).getTime();
  const endTs = new Date(body.endDate).getTime();
  if (Number.isNaN(startTs) || Number.isNaN(endTs) || endTs < startTs) {
    return NextResponse.json({ error: "invalid_dates" }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();

  const { data: pro } = await admin
    .from("pro_accounts")
    .select("wallet_balance_cents, raison_sociale, secteur, code_postal, plan")
    .eq("id", proId)
    .single();
  if (!pro) {
    return NextResponse.json({ error: "pro_not_found" }, { status: 404 });
  }

  const { data: planRow } = await admin
    .from("plan_pricing")
    .select("monthly_cents")
    .eq("plan", pro.plan)
    .single();
  const planFeeCents = Number(planRow?.monthly_cents ?? 0);

  if (Number(pro.wallet_balance_cents) < body.budgetCents + planFeeCents) {
    return NextResponse.json(
      {
        error: "insufficient_funds",
        walletCents: Number(pro.wallet_balance_cents),
        neededCents: body.budgetCents + planFeeCents,
      },
      { status: 402 },
    );
  }

  const campaignType = objectiveToCampaignType(body.objectiveId);
  const targeting = {
    objectiveId: body.objectiveId,
    subTypes: body.subTypes,
    requiredTiers: body.requiredTiers,
    requiredTierKeys: tierNumsToKeys(body.requiredTiers),
    geo: body.geo,
    ages: body.ages,
    verifLevel: body.verifLevel,
    keywords: body.keywords,
    kwFilter: body.kwFilter,
    poolMode: body.poolMode,
    days: body.days,
  };
  const name = (body.name?.trim() || body.brief.trim()).slice(0, 120);

  const { data: campaign, error: campErr } = await admin
    .from("campaigns")
    .insert({
      pro_account_id: proId,
      name,
      type: campaignType,
      status: "active",
      targeting,
      cost_per_contact_cents: body.costPerContactCents,
      budget_cents: body.budgetCents,
      brief: body.brief.trim(),
      starts_at: new Date(body.startDate).toISOString(),
      ends_at: new Date(body.endDate).toISOString(),
    })
    .select("id")
    .single();
  if (campErr || !campaign) {
    console.error("[/api/pro/campaigns] insert campaign failed", campErr);
    return NextResponse.json({ error: "insert_campaign_failed" }, { status: 500 });
  }

  let matched: Awaited<ReturnType<typeof findMatchingProspects>>;
  try {
    matched = await findMatchingProspects(admin, {
      objectiveId: body.objectiveId,
      requiredTiers: body.requiredTiers,
      geo: body.geo,
      proCodePostal: pro.code_postal ?? null,
      ages: body.ages,
      verifLevel: body.verifLevel,
      contacts: body.contacts,
    });
  } catch (err) {
    console.error("[/api/pro/campaigns] matching failed", err);
    await admin
      .from("campaigns")
      .update({ status: "paused", matched_count: 0 })
      .eq("id", campaign.id);
    return NextResponse.json({ error: "matching_failed" }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString();
  // body.brief is guaranteed non-empty by validation above.
  const motif = body.brief.trim();

  let insertedCount = 0;
  let warning: string | null = null;
  if (matched.length > 0) {
    const rows = matched.map((m) => ({
      campaign_id: campaign.id,
      pro_account_id: proId,
      prospect_id: m.prospectId,
      motif,
      reward_cents: body.costPerContactCents,
      status: "pending" as const,
      expires_at: expiresAt,
    }));
    const { data: inserted, error: relErr } = await admin
      .from("relations")
      .insert(rows)
      .select("id, prospect_id");
    if (relErr) {
      console.error("[/api/pro/campaigns] insert relations failed", relErr);
      // On garde la campagne mais on remonte un warning au caller.
      warning = "relations_insert_failed";
    } else {
      insertedCount = inserted?.length ?? 0;
    }
  }

  const { error: countErr } = await admin
    .from("campaigns")
    .update({ matched_count: insertedCount })
    .eq("id", campaign.id);
  if (countErr) {
    console.error("[/api/pro/campaigns] update matched_count failed", countErr);
  }

  // Mails fire-and-forget — Promise.allSettled non-awaité.
  const proSector = pro.secteur ?? null;
  const proName = pro.raison_sociale;
  const rewardEur = body.costPerContactCents / 100;
  void Promise.allSettled(
    matched
      .filter((m) => m.email)
      .map((m) =>
        sendRelationInvitation({
          email: m.email!,
          prenom: m.prenom,
          proName,
          proSector,
          motif,
          brief: body.brief.trim(),
          rewardEur,
          expiresAt,
        }),
      ),
  );

  const code = `BUUPP-${randomCode(4)}-${randomCode(4)}`;
  return NextResponse.json({
    campaignId: campaign.id,
    matchedCount: insertedCount,
    code,
    ...(warning ? { warning } : {}),
  });
}

function randomCode(n: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const [{ data: camps, error: campErr }, { data: rels, error: relErr }] = await Promise.all([
    admin
      .from("campaigns")
      .select("id, name, status, targeting, budget_cents, spent_cents, cost_per_contact_cents, created_at")
      .eq("pro_account_id", proId)
      .order("created_at", { ascending: false }),
    admin
      .from("relations")
      .select("campaign_id, status")
      .eq("pro_account_id", proId)
      .in("status", ["accepted", "settled"]),
  ]);

  if (campErr) {
    console.error("[/api/pro/campaigns GET] read campaigns failed", campErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (relErr) {
    console.error("[/api/pro/campaigns GET] read relations failed", relErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const contactsByCampaign = new Map<string, number>();
  for (const r of (rels ?? [])) {
    contactsByCampaign.set(r.campaign_id, (contactsByCampaign.get(r.campaign_id) ?? 0) + 1);
  }

  type Targeting = { objectiveId?: string };
  const campaigns = (camps ?? []).map((c) => {
    const targeting = (c.targeting as Targeting | null) ?? null;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      objectiveLabel: objectiveLabel(targeting?.objectiveId),
      budgetEur: Number(c.budget_cents ?? 0) / 100,
      spentEur: Number(c.spent_cents ?? 0) / 100,
      contactsCount: contactsByCampaign.get(c.id) ?? 0,
      createdAt: c.created_at,
      avgCostEur: Number(c.cost_per_contact_cents ?? 0) / 100,
    };
  });

  return NextResponse.json({ campaigns });
}
