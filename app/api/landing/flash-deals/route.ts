/**
 * GET /api/landing/flash-deals — public, optionally auth-aware.
 * Renvoie les campagnes "flash deal" (durationKey=1h) actuellement
 * actives, avec leurs informations publiques (nom, brief, motif,
 * paliers requis, gain en clair multiplié) + le timer d'expiration.
 *
 * Si l'appelant est authentifié et a un compte prospect, on enrichit
 * chaque deal avec :
 *   - relationId / relationStatus  (s'il a déjà reçu cette sollicitation)
 *   - missingTierKeys              (['identity'] si l'un des 7 champs —
 *                                   prénom / initiale / ville / sexe /
 *                                   tranche d'âge / téléphone / e-mail —
 *                                   manque, sinon [])
 *
 * Chaque deal expose `contactChannels` (téléphone et/ou e-mail). Les champs
 * `requiredTiers` ([1]) / `requiredTierKeys` (['identity']) sont conservés
 * pour les apps mobiles publiées.
 * Permet à la home page d'afficher un état adapté (accepter/refuser ou
 * "complétez vos données").
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  isContactProfileComplete,
  readContactChannels,
} from "@/lib/campaigns/contact-channels";
import { getFounderContext } from "@/lib/founders";
import { objectiveIdOf } from "@/lib/prospect/tracking-consent";
import {
  excludesPastAcceptors,
  PAST_ACCEPTOR_STATUSES,
  pastAcceptorCutoffIso,
} from "@/lib/campaigns/past-acceptors";

export const runtime = "nodejs";

// Head-start « profil prioritaire » : un flash deal est affiché aux profils
// prioritaires (fondateurs ≥ 3 filleuls) 20 min AVANT le grand public. Le
// lifetime d'un flash deal vaut 1h20 (cf. campaignLifetimeMs dans
// /api/pro/campaigns) : le prioritaire le voit pendant 1h20, le public
// pendant la dernière 1h (blackout des 20 premières minutes). Cette valeur
// DOIT rester synchronisée avec FLASH_PRIORITY_HEAD_START_MS côté création.
const FLASH_PRIORITY_HEAD_START_MS = 20 * 60 * 1000;

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

  // `getFounderContext` peut échouer si la migration fondateur n'est pas
  // encore appliquée (RPC absente) ou en cas de hoquet réseau — on dégrade
  // silencieusement vers un contexte non-fondateur pour éviter un 500 sur
  // cet endpoint public.
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

  // Head-start prioritaire : les profils prioritaires (fondateurs ≥ 3
  // filleuls) voient le flash deal dès son lancement (1h20). Le grand
  // public ne le voit qu'après ses 20 premières minutes → il en profite
  // pendant la dernière 1h pile. Le lifetime de la campagne (ends_at) est
  // déjà calé sur 1h20 à la création (cf. campaignLifetimeMs).
  let campaignQuery = admin
    .from("campaigns")
    .select(
      `id, name, ends_at, brief, cost_per_contact_cents, targeting, contact_channels,
       founder_bonus_enabled, budget_cents, created_at, pro_account_id,
       pro_accounts ( raison_sociale, secteur )`,
    )
    .eq("status", "active")
    .gt("ends_at", nowIso)
    .order("ends_at", { ascending: true })
    .limit(20);

  if (founder.filleulCount < 3) {
    campaignQuery = campaignQuery.lt(
      "created_at",
      new Date(Date.now() - FLASH_PRIORITY_HEAD_START_MS).toISOString(),
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
    pro_account_id: string;
    contact_channels: string[] | null;
    targeting: {
      durationKey?: string;
      durationMultiplier?: number;
      objectiveId?: string;
      excludePastAcceptors?: boolean;
      requiredTiers?: number[];
      requiredTierKeys?: string[];
    } | null;
    pro_accounts: { raison_sociale: string | null; secteur: string | null }
      | { raison_sociale: string | null; secteur: string | null }[]
      | null;
  };
  let flashes = ((data ?? []) as unknown as CampaignRow[]).filter(
    (r) => r.targeting?.durationKey === "1h",
  );

  // Comptage indicatif des flash deals lancés sur les 7 derniers jours
  // (tout statut), affiché dans l'empty state mobile pour donner une
  // idée du rythme. Stocké en clé séparée pour ne pas peser sur la
  // payload principale et fail-safe : 0 si la requête échoue.
  let lastSevenDaysCount = 0;
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const { data: weekRows } = await admin
      .from("campaigns")
      .select("targeting")
      .gte("created_at", since)
      .limit(500);
    lastSevenDaysCount = ((weekRows ?? []) as { targeting: { durationKey?: string } | null }[])
      .filter((r) => r.targeting?.durationKey === "1h")
      .length;
  } catch (e) {
    console.warn("[/api/landing/flash-deals] 7d count failed", e);
  }

  // ─── Profil contact + relations du prospect authentifié ────
  let contactComplete: boolean | null = null;
  let relationsByCampaign: Map<string, { id: string; status: string }> | null = null;
  if (prospect && flashes.length > 0) {
    const { data: ident } = await admin
      .from("prospect_identity")
      .select("prenom, nom, ville, genre, tranche_age, email, telephone")
      .eq("prospect_id", prospect.id)
      .maybeSingle();
    contactComplete = isContactProfileComplete(ident ?? null);

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

  // Option « exclure les anciens acceptants » : un prospect qui a déjà
  // accepté une campagne de ce pro (12 derniers mois) ne voit pas son
  // flash deal — il ne pourrait pas l'accepter (409 already_accepted_pro).
  // Une relation déjà existante sur CE flash reste affichée (historique).
  if (prospect && flashes.length > 0) {
    const proIds = [
      ...new Set(
        flashes
          .filter((f) => excludesPastAcceptors(f.targeting) && !relationsByCampaign?.has(f.id))
          .map((f) => f.pro_account_id),
      ),
    ];
    if (proIds.length > 0) {
      const { data: accepted, error: accErr } = await admin
        .from("relations")
        .select("pro_account_id, campaign_id, status, decided_at")
        .eq("prospect_id", prospect.id)
        .in("pro_account_id", proIds)
        .in("status", [...PAST_ACCEPTOR_STATUSES])
        .gte("decided_at", pastAcceptorCutoffIso());
      if (accErr) {
        console.warn("[/api/landing/flash-deals] past acceptors lookup failed", accErr);
      } else {
        const rows = accepted ?? [];
        flashes = flashes.filter(
          (f) =>
            !excludesPastAcceptors(f.targeting) ||
            relationsByCampaign?.has(f.id) ||
            !rows.some((r) => r.pro_account_id === f.pro_account_id && r.campaign_id !== f.id),
        );
      }
    }
  }

  const deals = flashes.map((r) => {
    const pro = Array.isArray(r.pro_accounts) ? r.pro_accounts[0] : r.pro_accounts;
    const targeting = r.targeting ?? {};
    // Plus de paliers de données : palier 1 seul (compat mobile publié).
    const requiredTiers = [1];
    const requiredTierKeys = ["identity"];
    const multiplier = Number(targeting.durationMultiplier ?? 3);
    const rel = relationsByCampaign?.get(r.id) ?? null;
    const missingTierKeys =
      contactComplete === null ? null : contactComplete ? [] : ["identity"];
    const baseCostCents = Number(r.cost_per_contact_cents ?? 0);
    // Le filleul voit sa récompense normale. Le bonus parrain (50 % à sa
    // 1ʳᵉ acceptation) est versé au PARRAIN, pas au filleul — il n'apparaît
    // donc pas comme un gain du prospect courant (cf. RPC accept_relation_tx).
    const displayedCostCents = baseCostCents;
    return {
      id: r.id,
      name: r.name,
      endsAt: r.ends_at,
      brief: r.brief,
      multiplier,
      costPerContactCents: displayedCostCents,
      founderBonusApplied: false,
      founderVipBonusApplied: false,
      requiredTiers,
      requiredTierKeys,
      // Modes de contact : le prospect sera appelé et/ou contacté par e-mail
      // (toujours via la plateforme BUUPP).
      contactChannels: readContactChannels(r.contact_channels),
      proName: pro?.raison_sociale ?? null,
      proSector: pro?.secteur ?? null,
      isAuthenticated: prospect !== null,
      relationId: rel?.id ?? null,
      relationStatus: rel?.status ?? null,
      missingTierKeys,
      // Objectif de la campagne (`addigital` → l'app iOS demande l'ATT).
      objectiveId: objectiveIdOf(r.targeting as Record<string, unknown> | null),
    };
  });

  return NextResponse.json({ deals, stats: { lastSevenDaysCount } });
}
