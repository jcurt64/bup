/**
 * POST /api/pro/campaigns — lance une campagne et notifie les prospects matchants.
 *
 * Algorithme (cf. spec §2 / §3) :
 *  1. ensureProAccount + lecture wallet + frais plan.
 *  2. Vérification solde ≥ budget + plan_fee → sinon 402.
 *  3. INSERT campaigns(active, brief, starts_at, ends_at).
 *  4. findMatchingProspects(LIMIT contacts).
 *  5. Batch INSERT relations(pending, expires_at = now()+72h).
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

const EXPIRY_HOURS = 72;

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

  const matched = await findMatchingProspects(admin, {
    objectiveId: body.objectiveId,
    requiredTiers: body.requiredTiers,
    geo: body.geo,
    proCodePostal: pro.code_postal ?? null,
    ages: body.ages,
    verifLevel: body.verifLevel,
    contacts: body.contacts,
  });

  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 3600 * 1000).toISOString();
  const motif = body.brief.trim() || name;

  let insertedCount = 0;
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
      // On garde la campagne mais on remonte le flag : aucune relation créée.
    } else {
      insertedCount = inserted?.length ?? 0;
    }
  }

  await admin
    .from("campaigns")
    .update({ matched_count: insertedCount })
    .eq("id", campaign.id);

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
