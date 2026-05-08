/**
 * POST /api/pro/campaigns — lance une campagne et notifie les prospects matchants.
 *
 * Algorithme (cf. spec §2 / §3) :
 *  1. ensureProAccount + lecture wallet + frais plan.
 *  2. Vérification solde ≥ budget + plan_fee → sinon 402.
 *  3. INSERT campaigns(active, brief, starts_at, ends_at).
 *  4. findMatchingProspects(LIMIT contacts).
 *  5. Batch INSERT relations(pending, expires_at = now()+durationKey).
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
import { rangeForRequiredTiers } from "@/lib/prospect/tier-rewards";

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
  /** Bonus fondateur : quand true (défaut), les acceptations par un fondateur
   *  coûtent 2× le tarif palier pendant le 1er mois post-lancement. */
  founder_bonus_enabled?: boolean;
};

const ALLOWED_CHANNELS = ["email", "phone", "sms", "whatsapp", "facebook", "linkedin"] as const;

const DURATION_MULTIPLIERS: Record<string, { mult: number; ms: number }> = {
  "1h":  { mult: 3,   ms: 3600 * 1000 },
  "24h": { mult: 2,   ms: 24 * 3600 * 1000 },
  "48h": { mult: 1.5, ms: 48 * 3600 * 1000 },
  "7d":  { mult: 1,   ms: 7 * 24 * 3600 * 1000 },
};

// La fenêtre de réponse du prospect (response window) ET la fermeture
// de la campagne sont calquées sur le `durationKey` choisi par le pro :
// 1h, 24h, 48h ou 7d. Auparavant ces valeurs étaient surchargées par
// des constantes de test (1 min / 5 min) qui rendaient les relations
// expirées avant même que le prospect n'ouvre son mail.

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
    .select(
      "wallet_balance_cents, wallet_reserved_cents, raison_sociale, secteur, code_postal, plan, plan_cycle_count",
    )
    .eq("id", proId)
    .single();
  if (!pro) {
    return NextResponse.json({ error: "pro_not_found" }, { status: 404 });
  }

  // Quota par cycle (popup de mode) : 2 campagnes pour Starter, 10 pour Pro.
  // Le compteur est remis à 0 quand le pro (re)sélectionne un mode dans le
  // sélecteur. Quand `plan_cycle_count >= max_campaigns`, on bloque côté
  // serveur et le client ré-ouvre la popup de mode.
  const { data: planRow } = await admin
    .from("plan_pricing")
    .select("monthly_cents, max_campaigns")
    .eq("plan", pro.plan)
    .single();
  const cycleCap = Number(planRow?.max_campaigns ?? (pro.plan === "pro" ? 10 : 2));
  const cycleCount = Number(pro.plan_cycle_count ?? 0);
  if (cycleCount >= cycleCap) {
    return NextResponse.json(
      {
        error: "mode_cap_reached",
        plan: pro.plan,
        cycleCount,
        cap: cycleCap,
      },
      { status: 403 },
    );
  }

  // Commission BUUPP : 10 % du budget de la campagne (worst-case : tous
  // les prospects acceptent). Le solde DISPONIBLE = wallet_balance -
  // wallet_reserved (les autres campagnes actives ont déjà réservé).
  const commissionCents = Math.round(body.budgetCents * 0.10);

  // Frais d'accès au cycle (Starter / Pro) : facturé UNE SEULE FOIS au
  // démarrage d'un cycle (cycleCount === 0). Les campagnes 2..N du cycle
  // réutilisent le quota déjà payé. Quand le pro (re)choisit un mode
  // dans la popup, plan_cycle_count est remis à 0 → la prochaine
  // campagne paye à nouveau les frais d'accès.
  const isFirstOfCycle = cycleCount === 0;
  const planFeeCents = isFirstOfCycle ? Number(planRow?.monthly_cents ?? 0) : 0;

  const neededCents = body.budgetCents + commissionCents + planFeeCents;
  const walletAvailableCents =
    Number(pro.wallet_balance_cents) - Number(pro.wallet_reserved_cents ?? 0);
  if (walletAvailableCents < neededCents) {
    return NextResponse.json(
      {
        error: "insufficient_funds",
        walletCents: Number(pro.wallet_balance_cents),
        walletReservedCents: Number(pro.wallet_reserved_cents ?? 0),
        walletAvailableCents,
        neededCents,
        commissionCents,
        planFeeCents,
        isFirstOfCycle,
        budgetCents: body.budgetCents,
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

  const founderBonusEnabled = body.founder_bonus_enabled !== false;

  const campaignType = objectiveToCampaignType(body.objectiveId);
  const finalChannels = [...ALLOWED_CHANNELS];
  const durationKey = typeof body.durationKey === "string" && body.durationKey in DURATION_MULTIPLIERS
    ? body.durationKey
    : "7d";
  const durationMeta = DURATION_MULTIPLIERS[durationKey];

  // Garde-fou rémunération minimum : `costPerContactCents` ne peut pas
  // tomber sous la borne basse du palier le plus élevé requis (× la
  // durée). C'est une protection prospect : impossible pour un pro de
  // payer moins que le minimum garanti pour les données qu'il demande.
  // On ne fixe PAS de plafond — le wizard ajoute légitimement des sous-
  // coûts (sous-objectif, bonus certifié confiance) qui peuvent porter
  // le cpc au-dessus de la borne haute du barème.
  const tierRange = rangeForRequiredTiers(body.requiredTiers);
  if (tierRange) {
    const { minCents, tier } = tierRange;
    const effMin = Math.round(minCents * durationMeta.mult);
    if (body.costPerContactCents < effMin) {
      const fmtEur = (c: number) => (c / 100).toFixed(2).replace(".", ",");
      return NextResponse.json(
        {
          error: "cost_below_tier_minimum",
          tier,
          minCents: effMin,
          costPerContactCents: body.costPerContactCents,
          durationMultiplier: durationMeta.mult,
          message: `Pour le palier ${tier} en ${durationKey}, la rémunération minimum est de ${fmtEur(effMin)} € par contact.`,
        },
        { status: 400 },
      );
    }
  }

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

  // Réservation upfront : (budget + commission max). Aucun centime ne
  // quitte encore le wallet ; close_campaign_settle débitera réellement
  // à la clôture (ends_at) selon les acceptations effectives.
  const reservedCents = body.budgetCents + commissionCents;
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
      budget_reserved_cents: reservedCents,
      commission_max_cents: commissionCents,
      brief: body.brief.trim(),
      // Campagne ouverte immédiatement et fermée à la fin de la fenêtre
      // de réponse (= durationKey choisi par le pro). C'est exactement
      // la même horloge que `relations.expires_at` ci-dessous, donc le
      // mail prospect, l'UI et la DB convergent toujours.
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + durationMeta.ms).toISOString(),
      founder_bonus_enabled: founderBonusEnabled,
    })
    .select("id")
    .single();
  if (campErr || !campaign) {
    console.error("[/api/pro/campaigns] insert campaign failed", campErr);
    return NextResponse.json({ error: "insert_campaign_failed" }, { status: 500 });
  }

  // Incrémente la réservation du pro (budget + commission max). Le
  // wallet "disponible" affiché côté UI = wallet_balance - wallet_reserved.
  // En parallèle, si c'est la 1re campagne du cycle, on débite IMMÉDIAT
  // les frais d'accès Starter/Pro (one-shot, non remboursables) — pas de
  // réservation, c'est un paiement effectif au moment de l'achat du cycle.
  const newReserved =
    Number(pro.wallet_reserved_cents ?? 0) + reservedCents;
  const newBalance =
    Number(pro.wallet_balance_cents) - planFeeCents;
  const { error: reserveErr } = await admin
    .from("pro_accounts")
    .update({
      wallet_reserved_cents: newReserved,
      wallet_balance_cents: newBalance,
    })
    .eq("id", proId);
  if (reserveErr) {
    console.error("[/api/pro/campaigns] reservation update failed", reserveErr);
  }
  if (planFeeCents > 0) {
    await admin.from("transactions").insert({
      account_id: proId,
      account_kind: "pro",
      type: "buupp_commission",
      status: "completed",
      amount_cents: -planFeeCents,
      campaign_id: campaign.id,
      description: `Frais cycle ${pro.plan === "pro" ? "Pro" : "Starter"} (${cycleCap} campagnes)`,
    });
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

  // Fenêtre de réponse côté prospect = durationKey du wizard (1h, 24h,
  // 48h ou 7d). Synchronisé avec `campaigns.ends_at`.
  const expiresAt = new Date(Date.now() + durationMeta.ms).toISOString();
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
  // Mapping prospect_id → relation_id, utilisé après l'INSERT pour
  // construire un lien direct vers la relation dans le mail.
  const relationIdByProspect = new Map<string, string>();
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
      for (const row of inserted ?? []) {
        relationIdByProspect.set(row.prospect_id, row.id);
      }
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

  // Incrémente le compteur de cycle : à la cap+1-ème tentative, le client
  // recevra `mode_cap_reached` (403) et ré-ouvrira la popup de mode.
  const { error: cycleErr } = await admin
    .from("pro_accounts")
    .update({ plan_cycle_count: cycleCount + 1 })
    .eq("id", proId);
  if (cycleErr) {
    console.error("[/api/pro/campaigns] cycle increment failed", cycleErr);
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
          relationId: relationIdByProspect.get(m.prospectId) ?? null,
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
      .select(
        `id, name, brief, status, targeting, budget_cents, spent_cents,
         cost_per_contact_cents, created_at, code, matched_count,
         ends_at, paused_at, auto_resume_at, pause_used,
         extension_used, extended_at`,
      )
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

  type Targeting = { objectiveId?: string; durationKey?: string };
  const campaigns = (camps ?? []).map((c) => {
    const targeting = (c.targeting as Targeting | null) ?? null;
    const durationKey = targeting?.durationKey ?? null;
    return {
      id: c.id,
      name: c.name,
      brief: c.brief ?? null,
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
      // Métadonnées pause/resume — la pause 48 h n'est ouverte qu'aux
      // campagnes 7d, et seulement une fois (`pauseUsed`).
      durationKey,
      endsAt: c.ends_at ?? null,
      pausedAt: c.paused_at ?? null,
      autoResumeAt: c.auto_resume_at ?? null,
      pauseUsed: Boolean(c.pause_used),
      // Pause one-shot disponible pour toutes les durées (1h flash deal
      // inclus) : seul le flag `pause_used` la verrouille.
      pauseEligible: !c.pause_used,
      // Prolongation : disponible une seule fois, pour toutes les durées,
      // tant que la campagne est encore active/en pause et non expirée.
      extensionUsed: Boolean(c.extension_used),
      extendedAt: c.extended_at ?? null,
      extendEligible:
        !c.extension_used &&
        (c.status === "active" || c.status === "paused") &&
        !!c.ends_at &&
        new Date(c.ends_at).getTime() > Date.now() &&
        !!durationKey,
    };
  });

  return NextResponse.json({ campaigns });
}
