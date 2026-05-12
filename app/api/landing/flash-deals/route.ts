/**
 * GET /api/landing/flash-deals — public, optionally auth-aware.
 * Renvoie les campagnes "flash deal" (durationKey=1h) actuellement
 * actives, avec leurs informations publiques (nom, brief, motif,
 * paliers requis, gain en clair multiplié) + le timer d'expiration.
 *
 * Si l'appelant est authentifié et a un compte prospect, on enrichit
 * chaque deal avec :
 *   - relationId / relationStatus  (s'il a déjà reçu cette sollicitation)
 *   - missingTierKeys              (paliers requis qu'il n'a pas remplis)
 * Permet à la home page d'afficher un état adapté (accepter/refuser ou
 * "complétez vos données").
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { TIERS, TIER_KEYS, type TierKey } from "@/lib/prospect/donnees";
import {
  getFounderContext,
  VIP_BUDGET_MIN_CENTS,
  VIP_FLAT_BONUS_CENTS,
} from "@/lib/founders";

export const runtime = "nodejs";

type ProspectIdRow = { id: string } | null;

export async function GET() {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // ─── Auth (optionnel) — résolution du prospect ─────────────────
  // Récupère uniquement l'id prospect courant si la session Clerk est
  // valide. La lecture des paliers et des relations se fait plus bas
  // (après la query campagnes), pas ici.
  // Anonyme : on continue sans prospect — le contexte fondateur sera
  // calculé en mode public.
  let prospect: ProspectIdRow = null;
  try {
    const { userId } = await auth();
    if (userId) {
      const { data: pRow } = await admin
        .from("prospects")
        .select("id")
        .eq("clerk_user_id", userId)
        .maybeSingle();
      prospect = (pRow as ProspectIdRow) ?? null;
    }
  } catch (e) {
    // Auth optionnelle — on log et continue en mode anonyme.
    console.warn("[/api/landing/flash-deals] auth context failed", e);
  }

  // `getFounderContext` peut échouer si la migration fondateur n'est
  // pas encore appliquée (RPC absente) ou en cas de hoquet réseau —
  // on dégrade silencieusement vers un contexte non-fondateur pour
  // éviter un 500 sur cet endpoint public.
  let founder = {
    isFounder: false,
    isWithinBonusWindow: false,
    filleulCount: 0,
    isVipEligible: false,
  };
  try {
    founder = await getFounderContext(admin, prospect?.id ?? null);
  } catch (e) {
    console.warn("[/api/landing/flash-deals] founder context failed", e);
  }

  // Fenêtre +10 min : seuls les fondateurs voient un flash deal créé il
  // y a moins de 10 min. Pour tout le monde d'autre, filtre serveur.
  let campaignQuery = admin
    .from("campaigns")
    .select(
      `id, name, ends_at, brief, cost_per_contact_cents, targeting,
       founder_bonus_enabled, budget_cents, created_at,
       pro_accounts ( raison_sociale, secteur )`,
    )
    .eq("status", "active")
    .gt("ends_at", nowIso)
    .order("ends_at", { ascending: true })
    .limit(20);

  if (!founder.isFounder) {
    campaignQuery = campaignQuery.lt(
      "created_at",
      new Date(Date.now() - 10 * 60_000).toISOString(),
    );
  }

  const { data, error } = await campaignQuery;

  if (error) {
    console.error("[/api/landing/flash-deals] read failed", error);
    return NextResponse.json({ deals: [] });
  }

  type CampaignRow = {
    id: string;
    name: string;
    ends_at: string;
    brief: string | null;
    cost_per_contact_cents: number;
    founder_bonus_enabled: boolean;
    budget_cents: number;
    created_at: string;
    targeting: {
      durationKey?: string;
      durationMultiplier?: number;
      requiredTiers?: number[];
      requiredTierKeys?: string[];
    } | null;
    pro_accounts: { raison_sociale: string | null; secteur: string | null }
      | { raison_sociale: string | null; secteur: string | null }[]
      | null;
  };
  const flashes = ((data ?? []) as unknown as CampaignRow[]).filter(
    (r) => r.targeting?.durationKey === "1h",
  );

  // ─── Tier fill state + relations for authenticated prospects ────
  let tierFilled: Record<TierKey, boolean> | null = null;
  let relationsByCampaign: Map<string, { id: string; status: string }> | null = null;
  if (prospect && flashes.length > 0) {
    // Lecture parallèle des 5 tables de paliers.
    const tierResults = await Promise.all(
      TIER_KEYS.map((key) =>
        admin
          .from(TIERS[key].table)
          .select("*")
          .eq("prospect_id", prospect!.id)
          .maybeSingle(),
      ),
    );
    const filled: Record<string, boolean> = {};
    TIER_KEYS.forEach((key, idx) => {
      const row = tierResults[idx].data as Record<string, unknown> | null;
      filled[key] = !!row && Object.values(TIERS[key].fields).some((dbCol) => {
        const v = row[dbCol];
        return typeof v === "string" && v.trim() !== "";
      });
    });
    tierFilled = filled as Record<TierKey, boolean>;

    // Relations existantes pour ce prospect sur les flash deals visibles.
    const ids = flashes.map((f) => f.id);
    const { data: rels } = await admin
      .from("relations")
      .select("id, campaign_id, status")
      .eq("prospect_id", prospect.id)
      .in("campaign_id", ids);
    relationsByCampaign = new Map();
    (rels ?? []).forEach((r) => {
      relationsByCampaign!.set(r.campaign_id as string, {
        id: r.id as string,
        status: r.status as string,
      });
    });
  }

  const deals = flashes.map((r) => {
    const pro = Array.isArray(r.pro_accounts) ? r.pro_accounts[0] : r.pro_accounts;
    const targeting = r.targeting ?? {};
    const requiredTiers = Array.isArray(targeting.requiredTiers) ? targeting.requiredTiers : [];
    const requiredTierKeys = Array.isArray(targeting.requiredTierKeys)
      ? (targeting.requiredTierKeys as string[]).filter((x): x is TierKey => (TIER_KEYS as string[]).includes(x))
      : [];
    const multiplier = Number(targeting.durationMultiplier ?? 3);
    const rel = relationsByCampaign?.get(r.id) ?? null;
    const missingTierKeys = tierFilled
      ? requiredTierKeys.filter((k) => !tierFilled![k])
      : null;
    const baseCostCents = Number(r.cost_per_contact_cents ?? 0);
    const campaignBudgetCents = Number(r.budget_cents ?? 0);
    // Bonus fondateur éligible globalement (toggle pro + fenêtre + statut).
    const founderBonusEligible =
      founder.isFounder &&
      founder.isWithinBonusWindow &&
      r.founder_bonus_enabled === true;
    // Palier VIP : 10 filleuls atteints ET budget campagne > 300 €.
    // Remplace le ×2 standard par un +5 € flat (cf. RPC accept_relation_tx).
    const founderVipEligible =
      founderBonusEligible &&
      founder.isVipEligible &&
      campaignBudgetCents > VIP_BUDGET_MIN_CENTS;
    let displayedCostCents = baseCostCents;
    if (founderVipEligible) {
      displayedCostCents = baseCostCents + VIP_FLAT_BONUS_CENTS;
    } else if (founderBonusEligible) {
      displayedCostCents = baseCostCents * 2;
    }
    return {
      id: r.id,
      name: r.name,
      endsAt: r.ends_at,
      brief: r.brief,
      multiplier,
      costPerContactCents: displayedCostCents,
      founderBonusApplied: founderBonusEligible && !founderVipEligible,
      founderVipBonusApplied: founderVipEligible,
      requiredTiers,
      requiredTierKeys,
      proName: pro?.raison_sociale ?? null,
      proSector: pro?.secteur ?? null,
      isAuthenticated: prospect !== null,
      relationId: rel?.id ?? null,
      relationStatus: rel?.status ?? null,
      missingTierKeys,
    };
  });

  return NextResponse.json({ deals });
}
