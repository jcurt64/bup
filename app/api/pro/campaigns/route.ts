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
  startDate: string;
  endDate: string;
  durationKey?: string;
  brief: string;
  costPerContactCents: number;
  budgetCents: number;
  keywords: string[];
  kwFilter: boolean;
  poolMode: string;
  /** Optionnel : quand true, exclut les prospects `certifie_confiance`
   *  du pool de matching. Coché par le pro dans le wizard, étape Budget. */
  excludeCertified?: boolean;
};

const ALLOWED_CHANNELS = ["email", "phone", "sms", "whatsapp", "facebook", "linkedin"] as const;

const DURATION_MULTIPLIERS: Record<string, { mult: number; ms: number }> = {
  "1h":  { mult: 3,   ms: 3600 * 1000 },
  "24h": { mult: 2,   ms: 24 * 3600 * 1000 },
  "48h": { mult: 1.5, ms: 48 * 3600 * 1000 },
  "7d":  { mult: 1,   ms: 7 * 24 * 3600 * 1000 },
};

// TEST : durée de validité réduite à 1 minute pour vérifier le flux
// d'expiration de la relation (response window prospect). Valeur
// produit nominale = 72 h (4320 min). À restaurer avant mise en prod.
const EXPIRY_MINUTES = 1;
// TEST : on ignore la fenêtre de diffusion choisie dans le wizard
// (body.startDate / body.endDate) et on force ends_at à now()+5min
// pour pouvoir tester la fermeture de campagne (campaignActive flippe
// à false après 5 minutes — le bouton "Refuser" disparaît, l'acceptation
// rétroactive depuis l'historique n'est plus permise). À retirer avant
// prod : restaurer body.startDate / body.endDate.
const CAMPAIGN_DURATION_MINUTES = 5;

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

  // Cap concurrent : 2 campagnes actives en parallèle pour Starter, illimité
  // pour Pro. Aligné avec la card de tarif et la PlanSwitcherSection.
  const STARTER_ACTIVE_CAP = 2;
  if (pro.plan === "starter") {
    const { count: activeCount, error: activeErr } = await admin
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("pro_account_id", proId)
      .eq("status", "active");
    if (activeErr) {
      console.error("[/api/pro/campaigns] active count failed", activeErr);
      return NextResponse.json({ error: "read_failed" }, { status: 500 });
    }
    if ((activeCount ?? 0) >= STARTER_ACTIVE_CAP) {
      return NextResponse.json(
        {
          error: "starter_cap_reached",
          plan: "starter",
          activeCount: activeCount ?? 0,
          cap: STARTER_ACTIVE_CAP,
        },
        { status: 403 },
      );
    }
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

  // Le plan Starter limite l'accès aux paliers 1 à 3 (cf. cards de prix
  // homepage / modal). Le plan Pro accède à tous les paliers (1 à 5).
  const planTierCap = pro.plan === "starter" ? 3 : 5;
  if (body.requiredTiers.some((t) => Number(t) > planTierCap)) {
    return NextResponse.json(
      { error: "tiers_above_plan_cap", planTierCap, plan: pro.plan },
      { status: 403 },
    );
  }

  const campaignType = objectiveToCampaignType(body.objectiveId);
  const finalChannels = [...ALLOWED_CHANNELS];
  const durationKey = typeof body.durationKey === "string" && body.durationKey in DURATION_MULTIPLIERS
    ? body.durationKey
    : "7d";
  const durationMeta = DURATION_MULTIPLIERS[durationKey];
  // Validation budget: doit couvrir contacts × cpc (et le cpc envoyé par le
  // front est censé déjà inclure le multiplicateur de durée — on vérifie
  // que budgetCents == contacts × costPerContactCents avec une tolérance
  // d'1 centime pour les arrondis).
  const expectedBudget = body.contacts * body.costPerContactCents;
  if (Math.abs(body.budgetCents - expectedBudget) > 1) {
    return NextResponse.json(
      { error: "budget_mismatch", expectedBudgetCents: expectedBudget, receivedBudgetCents: body.budgetCents },
      { status: 400 },
    );
  }
  const targeting = {
    objectiveId: body.objectiveId,
    subTypes: body.subTypes,
    requiredTiers: body.requiredTiers,
    requiredTierKeys: tierNumsToKeys(body.requiredTiers),
    geo: body.geo,
    ages: body.ages,
    verifLevel: body.verifLevel,
    excludeCertified: body.excludeCertified === true,
    keywords: body.keywords,
    kwFilter: body.kwFilter,
    poolMode: body.poolMode,
    durationKey,
    durationMultiplier: durationMeta.mult,
    channels: finalChannels,
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
      // TEST : on remplace la fenêtre choisie par le wizard par
      //   starts_at = now()
      //   ends_at   = now() + CAMPAIGN_DURATION_MINUTES
      // pour pouvoir vérifier rapidement la fermeture automatique de la
      // campagne (campaignActive=false → bouton "Refuser" masqué).
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + CAMPAIGN_DURATION_MINUTES * 60 * 1000).toISOString(),
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
      excludeCertified: body.excludeCertified === true,
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
  // Bonus ×2 sur la récompense pour les prospects "certifié confiance" :
  // quand un prospect a atteint le palier de confiance le plus élevé,
  // ses gains sont automatiquement doublés. La dépense côté pro suit le
  // même multiplicateur (le `reward_cents` stocké conditionne aussi le
  // débit du wallet à l'acceptation).
  const rewardForProspect = (m: (typeof matched)[number]) =>
    m.verification === "certifie_confiance"
      ? body.costPerContactCents * 2
      : body.costPerContactCents;
  if (matched.length > 0) {
    const rows = matched.map((m) => ({
      campaign_id: campaign.id,
      pro_account_id: proId,
      prospect_id: m.prospectId,
      motif,
      reward_cents: rewardForProspect(m),
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

  const code = `BUUPP-${randomCode(4)}-${randomCode(4)}`;
  const { error: countErr } = await admin
    .from("campaigns")
    .update({ matched_count: insertedCount, code })
    .eq("id", campaign.id);
  if (countErr) {
    console.error("[/api/pro/campaigns] update matched_count/code failed", countErr);
  }

  // Mails fire-and-forget — Promise.allSettled non-awaité.
  const proSector = pro.secteur ?? null;
  const proName = pro.raison_sociale;
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
          // Récompense effective : doublée si certifie_confiance.
          rewardEur: rewardForProspect(m) / 100,
          rewardDoubled: m.verification === "certifie_confiance",
          expiresAt,
        }),
      ),
  );

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
      .select("id, name, status, targeting, budget_cents, spent_cents, cost_per_contact_cents, created_at, code, matched_count")
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
      reachedCount: Number(c.matched_count ?? 0),
      createdAt: c.created_at,
      avgCostEur: Number(c.cost_per_contact_cents ?? 0) / 100,
      code: c.code ?? null,
      authCode: c.code ? c.code.slice(-4) : null,
    };
  });

  return NextResponse.json({ campaigns });
}
