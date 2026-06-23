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
  filterValidSubTypes,
  normalizeRadiusKm,
  objectiveLabel,
  objectiveToCampaignType,
  SUB_TYPES_BY_OBJECTIVE,
  tierNumsToKeys,
} from "@/lib/campaigns/mapping";
import { sendRelationInvitation } from "@/lib/email/relation";
import { sendReferralInvitation } from "@/lib/email/referral-invitation";
import { computeReferralReach } from "@/lib/founders/referral-reach";
import { buildClassicPayload, buildFlashPayload, sendBatch, type ExpoPushMessage } from "@/lib/push/expo";
import { rangeForRequiredTiers, TIER_REWARDS, type TierNum } from "@/lib/prospect/tier-rewards";

export const runtime = "nodejs";

type Body = {
  name?: string;
  objectiveId: string;
  subTypes: string[];
  requiredTiers: number[];
  geo: string;
  /** Fiabilité minimum exigée (0 = toutes, 60, 80) — étape 4 ciblage. */
  minFiabilite?: number;
  /** Rayon (km) pour le ciblage « autour de moi » (`geo === "around"`).
   *  Borné à 10/30/50 côté serveur (`normalizeRadiusKm`). */
  radiusKm?: number | null;
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
  /** « La Vitrine » — URL du site web (https uniquement) à afficher sur
   *  l'annonce côté prospect. Optionnel. Facturé 2 € (offert à la 1re
   *  campagne du pro ; le prix est décidé côté serveur, jamais par le client). */
  websiteUrl?: string;
  /** Optionnel : quand true, exclut les prospects `certifie_confiance`
   *  du pool de matching. Coché par le pro dans le wizard, étape Budget. */
  excludeCertified?: boolean;
  /** Bonus fondateur : quand true (défaut), les acceptations par un fondateur
   *  coûtent 2× le tarif palier pendant le 1er mois post-lancement. */
  founder_bonus_enabled?: boolean;
  /** Cible géographique précise choisie via l'autocomplete geo.api.gouv.fr
   *  côté wizard. Optionnel (rétro-compat) ; quand fourni, override la
   *  logique CP-prefix-du-pro pour filtrer le pool exactement sur la
   *  ville / le département / la région demandés. */
  geoTarget?:
    | { type: "ville"; nom: string; code: string; codesPostaux: string[] }
    | { type: "dept"; nom: string; code: string }
    | { type: "region"; nom: string; code: string; deptCodes: string[] }
    | null;
};

/** Valide et normalise la cible géographique reçue du wizard.
 *  Retourne null si le payload est absent ou malformé — le matching
 *  retombera sur la logique CP-prefix-du-pro. */
function normalizeGeoTarget(raw: unknown): Body["geoTarget"] | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (v.type === "ville" && typeof v.nom === "string" && typeof v.code === "string" && Array.isArray(v.codesPostaux)) {
    const cps = v.codesPostaux
      .filter((cp): cp is string => typeof cp === "string" && /^\d{5}$/.test(cp))
      .slice(0, 30);
    return cps.length > 0 ? { type: "ville", nom: v.nom.slice(0, 120), code: v.code.slice(0, 10), codesPostaux: cps } : null;
  }
  if (v.type === "dept" && typeof v.nom === "string" && typeof v.code === "string" && /^[\dA-Z]{2,3}$/i.test(v.code)) {
    return { type: "dept", nom: v.nom.slice(0, 120), code: v.code.toUpperCase().slice(0, 3) };
  }
  if (v.type === "region" && typeof v.nom === "string" && typeof v.code === "string" && Array.isArray(v.deptCodes)) {
    const codes = v.deptCodes
      .filter((c): c is string => typeof c === "string" && /^[\dA-Z]{2,3}$/i.test(c))
      .map((c) => c.toUpperCase())
      .slice(0, 30);
    return codes.length > 0 ? { type: "region", nom: v.nom.slice(0, 120), code: v.code.slice(0, 10), deptCodes: codes } : null;
  }
  return null;
}

/** Valide/normalise l'URL « Vitrine ». https UNIQUEMENT : un schéma absent
 *  est préfixé `https://`, un `http://` explicite est refusé. Retourne l'URL
 *  normalisée ou null si invalide (hostname sans point, espace, etc.). */
function normalizeWebsiteUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  if (/^http:\/\//i.test(s)) return null; // http refusé — https only
  if (!/^https:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (!u.hostname.includes(".") || /\s/.test(u.hostname)) return null;
  return u.toString().slice(0, 2048);
}

/** Tarif de l'option Vitrine, en cents (2 €). Offerte à la 1re campagne. */
const VITRINE_FEE_CENTS = 200;

const ALLOWED_CHANNELS = ["email", "phone", "sms", "whatsapp", "facebook", "linkedin"] as const;

const DURATION_MULTIPLIERS: Record<string, { mult: number; ms: number }> = {
  "1h":  { mult: 3,   ms: 3600 * 1000 },
  "24h": { mult: 2,   ms: 24 * 3600 * 1000 },
  "48h": { mult: 1.5, ms: 48 * 3600 * 1000 },
  "7d":  { mult: 1,   ms: 7 * 24 * 3600 * 1000 },
};

// Head-start « profil prioritaire » des flash deals : un flash deal (1h)
// est affiché aux profils prioritaires (fondateurs ≥ 3 filleuls) 20 min
// AVANT le grand public. Le public conserve donc une fenêtre pleine d'1h ;
// le lifetime total de la campagne flash = 1h + 20 min = 1h20. Ce head-start
// ne concerne QUE les flash deals (durationKey='1h') — les autres durées
// n'ont pas de blackout sur la home. Doit rester synchronisé avec le
// blackout côté GET /api/landing/flash-deals.
const FLASH_PRIORITY_HEAD_START_MS = 20 * 60 * 1000;

function campaignLifetimeMs(durationKey: string): number {
  const base = DURATION_MULTIPLIERS[durationKey].ms;
  return durationKey === "1h" ? base + FLASH_PRIORITY_HEAD_START_MS : base;
}

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

  if (!SUB_TYPES_BY_OBJECTIVE[body.objectiveId]) {
    return NextResponse.json({ error: "invalid_objective" }, { status: 400 });
  }
  const validSubTypes = filterValidSubTypes(body.objectiveId, body.subTypes);
  if (validSubTypes.length === 0) {
    return NextResponse.json({ error: "invalid_sub_types" }, { status: 400 });
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
      "wallet_balance_cents, wallet_reserved_cents, raison_sociale, ville, secteur, code_postal, latitude, longitude, plan, plan_cycle_count",
    )
    .eq("id", proId)
    .single();
  if (!pro) {
    return NextResponse.json({ error: "pro_not_found" }, { status: 404 });
  }

  // Garde-fou : on ne crée pas de campagne tant que le pro n'a pas
  // renseigné sa raison sociale ET sa ville (sinon l'annonce affichée
  // côté prospect serait incomplète / non-identifiable).
  // Cas observé : un pro qui s'inscrit garde l'email Clerk dans
  // `raison_sociale` par défaut. On considère qu'une raison_sociale
  // contenant '@' est non-renseignée (placeholder résiduel) — symétrique
  // à la règle d'affichage côté prospect (cf. originLabel dans movements).
  const rawRaison = (pro.raison_sociale ?? "").trim();
  const hasValidRaisonSociale = rawRaison.length > 0 && !rawRaison.includes("@");
  const hasValidVille = !!(pro.ville ?? "").trim();
  if (!hasValidRaisonSociale || !hasValidVille) {
    return NextResponse.json(
      {
        error: "missing_company_info",
        message:
          "Renseignez votre raison sociale et votre ville dans Mes informations avant de lancer une campagne.",
        missing: {
          raisonSociale: !hasValidRaisonSociale,
          ville: !hasValidVille,
        },
      },
      { status: 422 },
    );
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

  // « La Vitrine » — option lien du site web sur l'annonce. OFFERTE à la 1re
  // campagne du pro (aucune campagne antérieure), 2 € ensuite. Le prix est
  // décidé ici (jamais par le client) : on compte les campagnes existantes.
  const websiteUrl = normalizeWebsiteUrl(body.websiteUrl);
  let websiteAddonCents = 0;
  if (websiteUrl) {
    const { count: priorCampaigns } = await admin
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("pro_account_id", proId);
    websiteAddonCents = (priorCampaigns ?? 0) === 0 ? 0 : VITRINE_FEE_CENTS;
  }

  const neededCents = body.budgetCents + commissionCents + planFeeCents + websiteAddonCents;
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
        websiteAddonCents,
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

  // Garde-fou rémunération : `costPerContactCents` doit correspondre à
  // la formule du wizard (Pro.jsx → baseCpc), qui est la source de
  // vérité côté UX. Le backend miroite cette formule pour rester
  // cohérent : tout écart = bug ou manipulation client → on rejette.
  //   - Borne basse : protection prospect, le pro ne peut pas payer
  //     moins que le minimum garanti pour le palier le plus élevé
  //     qu'il demande (× la durée).
  //   - Borne haute : formule wizard = somme des midpoints (min+max)/2
  //     de CHAQUE palier sélectionné, × multiplicateur de vérification
  //     (p0=1, p1=1.5, p2=2 — cf. VERIF_LEVELS), × multiplicateur de
  //     durée. Le ×2 pour les prospects certifie_confiance s'applique
  //     ensuite automatiquement à chaque relation (cf. rewardForProspect).
  //   - Tolérance : 2 cents — couvre les rounds successifs du wizard
  //     (Math.round(x * 100) / 100 répété deux fois).
  const tierRange = rangeForRequiredTiers(body.requiredTiers);
  if (tierRange) {
    const { minCents, tier } = tierRange;
    const effMin = Math.round(minCents * durationMeta.mult);
    const VERIF_MULT: Record<string, number> = { p0: 1, p1: 1.5, p2: 2 };
    const verifMult = VERIF_MULT[body.verifLevel] ?? 1;
    // Somme des midpoints (min+max)/2 sur les paliers sélectionnés —
    // miroir exact de la boucle `selectedTiers.forEach` du wizard.
    const tierMidpointSumCents = body.requiredTiers.reduce<number>((sum, t) => {
      const n = Number(t);
      const r = TIER_REWARDS[n as TierNum];
      return r ? sum + (r.minCents + r.maxCents) / 2 : sum;
    }, 0);
    const effMax = Math.round(tierMidpointSumCents * verifMult * durationMeta.mult) + 2;
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
    if (body.costPerContactCents > effMax) {
      const fmtEur = (c: number) => (c / 100).toFixed(2).replace(".", ",");
      return NextResponse.json(
        {
          error: "cost_above_tier_maximum",
          tier,
          maxCents: effMax,
          costPerContactCents: body.costPerContactCents,
          durationMultiplier: durationMeta.mult,
          verifMult,
          message: `Le coût par contact (${fmtEur(body.costPerContactCents)} €) dépasse le plafond calculé pour vos paliers + vérification + durée (${fmtEur(effMax)} €).`,
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
  // Normalisation côté serveur : on n'accepte JAMAIS tel quel le payload
  // de geoTarget envoyé par le client (potentielle injection PostgREST si
  // on relâchait les regex). normalizeGeoTarget renvoie null si invalide.
  const geoTarget = normalizeGeoTarget(body.geoTarget);
  // Portée géographique : `national` par défaut (zone sélectionnée par
  // défaut dans le wizard). Toute valeur inconnue retombe sur `national`
  // pour rester cohérent avec le front et éviter un filtre involontaire.
  const ALLOWED_GEO = ["ville", "dept", "region", "national", "around"] as const;
  const geo = (ALLOWED_GEO as readonly string[]).includes(body.geo)
    ? body.geo
    : "national";
  // Rayon « autour de moi » borné à 10/30/50 km (ignoré hors geo=around).
  const radiusKm = geo === "around" ? normalizeRadiusKm(body.radiusKm) : null;
  // Fiabilité minimum : seuils figés (0 = toutes, 60 = bonne, 80 = excellente).
  const ALLOWED_FIAB = [0, 60, 80];
  const minFiabilite = ALLOWED_FIAB.includes(Number(body.minFiabilite))
    ? Number(body.minFiabilite)
    : 0;

  // Ciblage « autour de moi » : nécessite les coordonnées de l'établissement
  // (géocodées depuis l'adresse via /api/pro/info). Sans elles, on ne peut pas
  // mesurer la distance aux prospects → on refuse AVANT toute réservation de
  // budget, avec un message qui pointe vers « Mes informations ».
  const proLat = typeof pro.latitude === "number" ? pro.latitude : null;
  const proLng = typeof pro.longitude === "number" ? pro.longitude : null;
  if (geo === "around" && (proLat == null || proLng == null)) {
    return NextResponse.json(
      {
        error: "pro_address_required",
        message:
          "Renseignez l'adresse de votre établissement dans Mes informations pour cibler autour de vous.",
      },
      { status: 400 },
    );
  }

  const targeting = {
    objectiveId: body.objectiveId,
    subTypes: validSubTypes,
    requiredTiers: body.requiredTiers,
    requiredTierKeys: tierNumsToKeys(body.requiredTiers),
    geo,
    geoTarget,
    radiusKm,
    ages: body.ages,
    verifLevel: body.verifLevel,
    excludeCertified: body.excludeCertified === true,
    minFiabilite,
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
      // « La Vitrine » : lien du site affiché sur l'annonce + tarif réellement
      // débité (0 si offert à la 1re campagne, 200 sinon).
      website_url: websiteUrl,
      website_addon_paid_cents: websiteAddonCents,
      // Campagne ouverte immédiatement et fermée à la fin de la fenêtre
      // de réponse (= durationKey choisi par le pro, + 20 min de head-start
      // prioritaire pour un flash deal 1h → lifetime 1h20). C'est exactement
      // la même horloge que `relations.expires_at` ci-dessous, donc le
      // mail prospect, l'UI et la DB convergent toujours.
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + campaignLifetimeMs(durationKey)).toISOString(),
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
  // Débit immédiat (non remboursable) : frais de cycle + option Vitrine.
  // Comme les frais de cycle, l'option Vitrine est un paiement effectif au
  // moment de l'achat — pas une réservation.
  const newBalance =
    Number(pro.wallet_balance_cents) - planFeeCents - websiteAddonCents;
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
  if (websiteAddonCents > 0) {
    await admin.from("transactions").insert({
      account_id: proId,
      account_kind: "pro",
      type: "buupp_commission",
      status: "completed",
      amount_cents: -websiteAddonCents,
      campaign_id: campaign.id,
      description: "Option La Vitrine (lien du site web)",
    });
  }

  // Auto-recharge : déclenche un PaymentIntent off-session si le solde
  // est désormais sous le seuil configuré par le pro (frais cycle +
  // réservation budget peuvent passer le wallet sous le seuil).
  // Fire-and-forget — n'impacte pas la réponse API.
  void (async () => {
    try {
      const { maybeTriggerAutoRecharge } = await import("@/lib/stripe/auto-recharge");
      await maybeTriggerAutoRecharge(proId);
    } catch (err) {
      console.warn("[campaigns] auto-recharge trigger failed (non-blocking)", err);
    }
  })();

  let matched: Awaited<ReturnType<typeof findMatchingProspects>>;
  try {
    matched = await findMatchingProspects(admin, {
      objectiveId: body.objectiveId,
      requiredTiers: body.requiredTiers,
      geo,
      geoTarget,
      proCodePostal: pro.code_postal ?? null,
      proLat,
      proLng,
      radiusKm,
      ages: body.ages,
      verifLevel: body.verifLevel,
      contacts: body.contacts,
      excludeCertified: body.excludeCertified === true,
      minFiabilitePct: minFiabilite,
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
  // 48h ou 7d), + 20 min de head-start pour un flash deal 1h. Synchronisé
  // avec `campaigns.ends_at` (même horloge).
  const expiresAt = new Date(Date.now() + campaignLifetimeMs(durationKey)).toISOString();
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
    // `contact_quota` = nombre de contacts payés = plafond d'acceptations
    // (ciblés + filleuls). Garde appliquée dans accept_relation_tx. Toujours
    // posé au lancement (le bonus parrain ne fait qu'ajouter des relations
    // « extra » qui se disputent ce même quota).
    .update({ matched_count: insertedCount, code, contact_quota: body.contacts })
    .eq("id", campaign.id);
  if (countErr) {
    console.error("[/api/pro/campaigns] update matched_count/code failed", countErr);
  }

  // ─── Bonus parrain v2 : reach étendu aux filleuls ──────────────────
  // Si le bonus est actif, on sollicite AUSSI les filleuls des parrains
  // ciblés (même hors cible), avec mail + message dédiés. Les acceptations
  // restent plafonnées au quota payé (contact_quota, garde côté RPC) ; le
  // parrain touche +0,5× forfaitaire à SA propre acceptation (relation
  // flaggée `referral_parrain_bonus`). Best-effort : un échec ici ne casse
  // pas le lancement.
  if (founderBonusEnabled && matched.length > 0) {
    try {
      const { filleuls } = await computeReferralReach(admin, {
        matched: matched.map((m) => ({ prospectId: m.prospectId, email: m.email })),
        // Borne la CRÉATION de relations extra (les acceptations sont de toute
        // façon plafonnées au quota par la RPC). Total relations ≤ ~2× contacts.
        maxExtra: body.contacts,
      });
      if (filleuls.length > 0) {
        const filleulRows = filleuls.map((f) => ({
          campaign_id: campaign.id,
          pro_account_id: proId,
          prospect_id: f.prospectId,
          motif,
          reward_cents:
            f.verification === "certifie_confiance"
              ? body.costPerContactCents * 2
              : body.costPerContactCents,
          status: "pending" as const,
          expires_at: expiresAt,
          referral_extra: true,
        }));
        const { data: insertedF, error: fErr } = await admin
          .from("relations")
          .insert(filleulRows)
          .select("id, prospect_id");
        if (fErr) {
          console.error("[/api/pro/campaigns] filleul relations insert failed", fErr);
        } else {
          const relIdByFilleul = new Map<string, string>();
          for (const r of insertedF ?? []) relIdByFilleul.set(r.prospect_id, r.id);
          // Le bonus parrain n'est PAS flaggé ici : il est calculé à
          // l'acceptation de CHAQUE filleul (accept_relation_tx, via la
          // waitlist), à vie. Le parrain n'a pas besoin d'accepter lui-même.
          // Notifs filleuls — email + message in-app ciblé (onglet « Mes messages »).
          const rewardEurFor = (v: string) =>
            (v === "certifie_confiance"
              ? body.costPerContactCents * 2
              : body.costPerContactCents) / 100;
          void Promise.allSettled(
            filleuls
              .filter((f) => f.email)
              .map((f) =>
                sendReferralInvitation({
                  email: f.email!,
                  prenom: f.prenom,
                  proName: pro.raison_sociale,
                  rewardEur: rewardEurFor(f.verification),
                  expiresAt,
                  relationId: relIdByFilleul.get(f.prospectId) ?? null,
                }),
              ),
          );
          const broadcastRows = filleuls
            .filter((f) => f.clerkUserId)
            .map((f) => ({
              title: "Une sollicitation via votre parrain",
              body: `Votre parrain a reçu une sollicitation de ${pro.raison_sociale} qui pourrait aussi vous intéresser. Renseignez vos informations pour l'accepter et toucher vos gains.`,
              audience: "prospects" as const,
              created_by_admin_id: "system",
              total_recipients: 1,
              target_clerk_user_id: f.clerkUserId!,
            }));
          if (broadcastRows.length > 0) {
            const { error: bErr } = await admin
              .from("admin_broadcasts")
              .insert(broadcastRows);
            if (bErr) {
              console.error("[/api/pro/campaigns] filleul broadcast insert failed", bErr);
            }
          }
        }
      }
    } catch (e) {
      console.error("[/api/pro/campaigns] referral reach failed", e);
    }
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

  // Push notifications fire-and-forget — résolution des tokens Expo
  // (push_tokens.user_id = prospects.clerk_user_id) puis envoi batch.
  void (async () => {
    try {
      const isFlash = durationKey === "1h";
      const prospectIds = matched.map((m) => m.prospectId);
      if (prospectIds.length === 0) return;

      // 1. Map prospect_id → clerk_user_id.
      const { data: pRows, error: pErr } = await admin
        .from("prospects")
        .select("id, clerk_user_id")
        .in("id", prospectIds);
      if (pErr) {
        console.error("[/api/pro/campaigns push] prospects lookup failed", pErr);
        return;
      }
      const clerkByProspect = new Map<string, string>();
      for (const r of pRows ?? []) {
        if (r.clerk_user_id) clerkByProspect.set(r.id, r.clerk_user_id);
      }

      // 2. Récupère tous les tokens Expo de ces users.
      const clerkIds = [...new Set([...clerkByProspect.values()])];
      if (clerkIds.length === 0) return;
      const { data: tokens, error: tErr } = await admin
        .from("push_tokens")
        .select("user_id, expo_token")
        .in("user_id", clerkIds);
      if (tErr) {
        console.error("[/api/pro/campaigns push] tokens lookup failed", tErr);
        return;
      }

      // 3. Index tokens par user_id (multi-device).
      const tokensByClerk = new Map<string, string[]>();
      for (const row of tokens ?? []) {
        const list = tokensByClerk.get(row.user_id) ?? [];
        list.push(row.expo_token);
        tokensByClerk.set(row.user_id, list);
      }

      // 4. Construit un message par (prospect × token).
      const messages: ExpoPushMessage[] = [];
      for (const m of matched) {
        const clerk = clerkByProspect.get(m.prospectId);
        if (!clerk) continue;
        const userTokens = tokensByClerk.get(clerk) ?? [];
        if (userTokens.length === 0) continue;
        const relationId = relationIdByProspect.get(m.prospectId);
        if (!relationId) continue;
        const rewardEur = rewardForProspect(m) / 100;
        for (const token of userTokens) {
          messages.push(
            isFlash
              ? buildFlashPayload({
                  token,
                  proName,
                  rewardEur,
                  relationId,
                  campaignId: campaign.id,
                })
              : buildClassicPayload({
                  token,
                  proName,
                  rewardEur,
                  durationKey,
                  relationId,
                }),
          );
        }
      }

      await sendBatch(admin, messages);
    } catch (e) {
      console.error("[/api/pro/campaigns push] unexpected error", e);
    }
  })();

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
      objectiveId: targeting?.objectiveId ?? null,
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
