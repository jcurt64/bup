/**
 * GET   /api/pro/campaigns/[id] — détail enrichi d'une campagne du pro.
 * PATCH /api/pro/campaigns/[id] — toggle status (active ↔ paused).
 *
 * GET — alimente l'écran "Détails" côté Pro.jsx :
 *   - identité : name, status, brief, dates, budget, spent, costPerContact
 *   - targeting : objectiveId/Label, subTypes, requiredTiers, geo, ages,
 *                 verifLevel, keywords, kwFilter, poolMode, days
 *   - funnel : counts par status (pending, accepted, refused, expired, settled)
 *   - contacts : liste des prospects accepted/settled (prenom, nom, score,
 *                tier, decided_at, status) joints sur prospect_identity
 *   - activity : 20 derniers événements de la campagne (envoi, accept, refus)
 *
 * PATCH — body { status: 'active' | 'paused' } :
 *   - auth Clerk
 *   - ownership : la campagne appartient au pro courant
 *   - transition autorisée :
 *       active → paused   ✓
 *       paused → active   ✓ si campaigns.ends_at > now()
 *       autres            → 409 invalid_transition
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { objectiveLabel } from "@/lib/campaigns/mapping";
import {
  validateAgesWiden,
  classifyGeoWiden,
  classifyVerifWiden,
  classifyFiabiliteWiden,
  type GeoWidenRequest,
} from "@/lib/campaigns/edit-targeting";
import { buildWidenedGeoTarget } from "@/lib/geo/france-admin";
import { resolicitNewlyEligible } from "@/lib/campaigns/resolicit";
import {
  filterCampaignContacts,
  type ContactStatusFilter,
  type ContactPeriodFilter,
} from "@/lib/pro/filterCampaignContacts";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";
import { settleRipeRelationsAndNotify } from "@/lib/settle/ripe";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type Targeting = {
  objectiveId?: string;
  subTypes?: string[];
  requiredTiers?: number[];
  requiredTierKeys?: string[];
  geo?: string;
  geoTarget?:
    | { type: "ville"; nom?: string; code?: string; codesPostaux?: string[] }
    | { type: "dept"; nom?: string; code?: string }
    | { type: "region"; nom?: string; code?: string; deptCodes?: string[] }
    | null;
  radiusKm?: number | null;
  ages?: string[];
  verifLevel?: string;
  minFiabilite?: number | null;
  keywords?: string[];
  kwFilter?: boolean;
  poolMode?: string;
  days?: number;
  durationKey?: string;
  excludeCertified?: boolean;
};

const TIER_NUM_TO_LABEL: Record<number, string> = {
  1: "P1 · Identification",
  2: "P2 · Localisation",
  3: "P3 · Style de vie",
  4: "P4 · Vie pro",
  5: "P5 · Patrimoine",
};

const VERIF_LEVEL_LABEL: Record<string, string> = {
  p0: "Aucune (basique accepté)",
  p1: "Vérifié — niveau 1",
  p2: "Certifié — niveau 2",
  p3: "Confiance — niveau 3",
};

const GEO_LABEL: Record<string, string> = {
  ville: "Ville (rayon 20 km)",
  dept: "Département",
  region: "Région",
  national: "National",
  around: "Autour de moi",
};

const POOL_LABEL: Record<string, string> = {
  standard: "Mise en relation individuelle",
  groupe: "Groupe / lot",
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export async function GET(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // Filtres optionnels de la liste « Contacts obtenus » (rétro-compat :
  // aucun param = comportement historique). Valeur invalide → défaut.
  const sp = new URL(req.url).searchParams;
  const rawStatus = sp.get("cstatus");
  const contactStatus: ContactStatusFilter =
    rawStatus === "accepted" || rawStatus === "settled" ? rawStatus : "all";
  const rawScoreMinStr = sp.get("cscoremin");
  const rawScoreMin =
    rawScoreMinStr == null || rawScoreMinStr.trim() === ""
      ? Number.NaN
      : Number(rawScoreMinStr);
  const contactScoreMin =
    Number.isFinite(rawScoreMin) && rawScoreMin >= 0
      ? Math.floor(rawScoreMin)
      : null;
  const rawPeriod = sp.get("cperiod");
  const contactPeriod: ContactPeriodFilter =
    rawPeriod === "7d" || rawPeriod === "30d" || rawPeriod === "90d"
      ? rawPeriod
      : "all";

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();

  // À l'accès pro : clôture les campagnes échues (ends_at dépassé) pour que
  // les données apparaissent dès la fin. Best-effort, idempotent.
  try {
    await settleRipeRelationsAndNotify(admin);
  } catch (err) {
    console.error("[/api/pro/campaigns/GET] lifecycle trigger failed", err);
  }

  const { data: camp, error: campErr } = await admin
    .from("campaigns")
    .select(
      `id, name, status, brief, targeting,
       budget_cents, spent_cents, cost_per_contact_cents, matched_count,
       starts_at, ends_at, created_at, pro_account_id,
       extension_used, extended_at,
       pause_used, paused_at, auto_resume_at,
       website_url, website_addon_paid_cents`,
    )
    .eq("id", id)
    .single();
  if (campErr || !camp) {
    return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
  }
  if (camp.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Lectures parallèles : relations de la campagne (status pour funnel,
  // détails pour contacts/activity, identités prospect joints).
  const { data: rels, error: relErr } = await admin
    .from("relations")
    .select(
      `id, status, sent_at, decided_at, settled_at, reward_cents,
       prospect_id,
       prospects ( bupp_score, prospect_identity ( prenom, nom ) )`,
    )
    .eq("campaign_id", id)
    .order("sent_at", { ascending: false });

  if (relErr) {
    console.error("[/api/pro/campaigns/GET] read relations failed", relErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  // « La Vitrine » — nombre de prospects distincts ayant cliqué vers le site
  // (1 clic max par prospect via la contrainte unique). Le dénominateur du
  // ratio affiché côté pro = winCount (acceptées + créditées), calculé plus bas.
  const { count: websiteClickCount } = await admin
    .from("campaign_website_clicks")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id);

  type RelationRow = {
    id: string;
    status: string;
    sent_at: string;
    decided_at: string | null;
    settled_at: string | null;
    reward_cents: number | string;
    prospect_id: string;
    prospects: {
      bupp_score: number | null;
      prospect_identity: { prenom: string | null; nom: string | null } | null;
    } | null;
  };

  const rows = (rels ?? []) as unknown as RelationRow[];

  // Funnel — counts par status. matched_count est figé au moment du lancement
  // (cf. POST /api/pro/campaigns), donc on l'expose tel quel pour le sommet
  // de l'entonnoir et on calcule les niveaux suivants depuis `relations`.
  const funnel = {
    matched: camp.matched_count ?? 0,
    sent: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    accepted: rows.filter((r) => r.status === "accepted").length,
    refused: rows.filter((r) => r.status === "refused").length,
    expired: rows.filter((r) => r.status === "expired").length,
    settled: rows.filter((r) => r.status === "settled").length,
  };
  // "Wins" = relations où le prospect a accepté (en séquestre OU déjà créditées).
  const winCount = funnel.accepted + funnel.settled;
  const decidedCount = winCount + funnel.refused + funnel.expired;
  // Taux d'acceptation = acceptations / sollicitations envoyées.
  // Bug corrigé : auparavant on divisait par decidedCount, ce qui faisait
  // afficher 100 % alors qu'une seule personne sur 10 avait accepté
  // (les 9 autres étaient encore "pending"). Le pro veut savoir combien
  // de prospects qu'il a sollicités ont accepté, pas seulement le ratio
  // parmi ceux ayant déjà tranché.
  const acceptanceRate = funnel.sent > 0
    ? Math.round((winCount / funnel.sent) * 1000) / 10
    : null;

  // Liste des contacts : seulement les relations gagnées (accepted/settled),
  // joint sur l'identité prospect pour afficher prénom + nom + score.
  const allContacts = rows
    .filter((r) => r.status === "accepted" || r.status === "settled")
    .map((r) => {
      const ident = r.prospects?.prospect_identity ?? null;
      const prenom = ident?.prenom?.trim() || "";
      const nom = ident?.nom?.trim() || "";
      const fullName = [prenom, nom].filter(Boolean).join(" ") || "Prospect";
      const tierLabel = (() => {
        const targeting = (camp.targeting as Targeting | null) ?? null;
        const tiers = targeting?.requiredTiers;
        if (!Array.isArray(tiers) || tiers.length === 0) return "—";
        const max = Math.max(...tiers.map((n) => Number(n) || 0));
        return TIER_NUM_TO_LABEL[max] ?? "—";
      })();
      return {
        id: r.id,
        prospectId: r.prospect_id,
        name: fullName,
        score: r.prospects?.bupp_score ?? null,
        tierLabel,
        decidedAt: r.decided_at ?? r.sent_at,
        statusLabel: r.status === "settled" ? "Crédité" : "En séquestre",
        statusChip: r.status === "settled" ? "good" : "warn",
        status: r.status,
      };
    });
  // Filtres optionnels appliqués À LA LISTE CONTACTS UNIQUEMENT.
  // `funnel` et `activity` restent calculés sur l'ensemble non filtré
  // (stats globales de la campagne, pas la vue filtrée).

  // Données par prospect masquées tant que la campagne n'est pas clôturée :
  // le pro ne voit que les compteurs (funnel) avant la clôture.
  const contactsUnlocked = proCanSeeContacts(camp.status);
  const contacts = contactsUnlocked
    ? filterCampaignContacts(allContacts, {
        status: contactStatus,
        scoreMin: contactScoreMin,
        period: contactPeriod,
      }).slice(0, 50)
    : [];

  // Activity feed : derniers événements ordonnés par "date la plus récente"
  // (settled_at > decided_at > sent_at). Limité à 20 lignes.
  const activityAll = rows
    .map((r) => {
      const ident = r.prospects?.prospect_identity ?? null;
      const fullName = [ident?.prenom, ident?.nom].filter(Boolean).join(" ").trim() || "Un prospect";
      let ts: string;
      let kind: "settled" | "accepted" | "refused" | "expired" | "pending";
      let label: string;
      if (r.settled_at) {
        ts = r.settled_at;
        kind = "settled";
        label = `${fullName} a été crédité — délai de validation écoulé`;
      } else if (r.decided_at && r.status === "accepted") {
        ts = r.decided_at;
        kind = "accepted";
        label = `${fullName} a accepté votre mise en relation`;
      } else if (r.decided_at && r.status === "refused") {
        ts = r.decided_at;
        kind = "refused";
        label = `${fullName} a refusé votre mise en relation`;
      } else if (r.status === "expired") {
        ts = r.decided_at ?? r.sent_at;
        kind = "expired";
        label = `Demande expirée — ${fullName} n'a pas répondu dans le délai`;
      } else {
        ts = r.sent_at;
        kind = "pending";
        label = `Demande envoyée à ${fullName}`;
      }
      return { ts, kind, label };
    })
    .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
    .slice(0, 20);
  // Activity contient des identités prospect → masquée tant que la campagne
  // n'est pas clôturée (parité avec la liste contacts).
  const activity = contactsUnlocked ? activityAll : [];

  const targeting = (camp.targeting as Targeting | null) ?? null;
  const tierLabels = (targeting?.requiredTiers ?? [])
    .map((n) => TIER_NUM_TO_LABEL[Number(n)] ?? null)
    .filter((s): s is string => !!s);

  const budgetEur = Number(camp.budget_cents ?? 0) / 100;
  const spentEur = Number(camp.spent_cents ?? 0) / 100;
  const cpcEur = Number(camp.cost_per_contact_cents ?? 0) / 100;
  const avgCostEur = winCount > 0 ? Math.round((spentEur / winCount) * 100) / 100 : cpcEur;

  return NextResponse.json({
    id: camp.id,
    name: camp.name,
    status: camp.status,
    brief: camp.brief ?? "",
    objectiveLabel: objectiveLabel(targeting?.objectiveId),
    objectiveId: targeting?.objectiveId ?? null,
    startsAt: camp.starts_at,
    endsAt: camp.ends_at,
    createdAt: camp.created_at,
    startsAtLabel: fmtDate(camp.starts_at),
    endsAtLabel: fmtDate(camp.ends_at),
    createdAtLabel: fmtDate(camp.created_at),
    budgetEur,
    spentEur,
    remainingEur: Math.max(0, budgetEur - spentEur),
    costPerContactEur: cpcEur,
    avgCostEur,
    targeting: {
      subTypes: targeting?.subTypes ?? [],
      requiredTiers: targeting?.requiredTiers ?? [],
      tierLabels,
      geo: targeting?.geo ?? null,
      geoLabel: targeting?.geo ? GEO_LABEL[targeting.geo] ?? targeting.geo : "—",
      // Rayon « autour de moi » courant (km) — nécessaire à la popup
      // d'édition pour ne proposer que des rayons strictement plus larges.
      radiusKm: typeof targeting?.radiusKm === "number" ? targeting.radiusKm : null,
      ages: targeting?.ages ?? [],
      verifLevel: targeting?.verifLevel ?? null,
      verifLabel: targeting?.verifLevel ? VERIF_LEVEL_LABEL[targeting.verifLevel] ?? targeting.verifLevel : "—",
      // Seuil de fiabilité minimum courant (0/60/80) — la popup d'édition ne
      // propose que des seuils inférieurs ou égaux (élargir seulement).
      minFiabilite: typeof targeting?.minFiabilite === "number" ? targeting.minFiabilite : 0,
      keywords: targeting?.keywords ?? [],
      kwFilter: !!targeting?.kwFilter,
      poolMode: targeting?.poolMode ?? null,
      poolLabel: targeting?.poolMode ? POOL_LABEL[targeting.poolMode] ?? targeting.poolMode : "—",
      days: targeting?.days ?? null,
      // Champs supplémentaires nécessaires à la duplication (pré-remplissage
      // du wizard) : durée originale + flag exclusion certifié confiance.
      durationKey: targeting?.durationKey ?? null,
      excludeCertified: !!targeting?.excludeCertified,
    },
    // Contacts cible originaux (= budget/cpc, arrondi à l'entier).
    // Distinct de `contacts` (liste des prospects acceptés ci-dessous).
    plannedContacts: cpcEur > 0 ? Math.round(budgetEur / cpcEur) : 0,
    // Métadonnées de prolongation.
    extensionUsed: Boolean(camp.extension_used),
    extendedAtLabel: camp.extended_at ? fmtDate(camp.extended_at) : null,
    extendEligible:
      !camp.extension_used &&
      (camp.status === "active" || camp.status === "paused") &&
      !!camp.ends_at &&
      new Date(camp.ends_at).getTime() > Date.now() &&
      !!targeting?.durationKey,
    // Métadonnées de pause 48 h (ouverte aux campagnes 7d uniquement,
    // une seule fois par campagne — cf. Campagnes.tsx).
    pauseUsed: Boolean(camp.pause_used),
    pausedAt: camp.paused_at ?? null,
    autoResumeAt: camp.auto_resume_at ?? null,
    // Pause disponible pour toutes les durées (cf. campaigns/route.ts).
    pauseEligible: !camp.pause_used,
    durationKey: targeting?.durationKey ?? null,
    funnel,
    acceptanceRate,
    decidedCount,
    winCount,
    contacts,
    activity,
    contactsLocked: !contactsUnlocked,
    // Date de déblocage indiquée seulement pour une campagne `active` : pour
    // une campagne `paused`, `ends_at` est périmé (il sera décalé de la durée
    // de pause à la reprise) → on ne montre pas de date trompeuse.
    lockedUntil:
      !contactsUnlocked && camp.status === "active"
        ? (camp.ends_at ?? null)
        : null,
    // « La Vitrine » — lien du site, montant payé pour l'option (0 ou 200),
    // et nombre de prospects ayant cliqué. Le front affiche
    // « X clics vers votre site / winCount prospects acceptés ».
    websiteUrl: camp.website_url ?? null,
    websiteAddonPaidCents: Number(camp.website_addon_paid_cents ?? 0),
    websiteClickCount: websiteClickCount ?? 0,
  });
}

type EditGeoBody =
  | { mode: "around"; radiusKm?: number }
  | { mode: "national" }
  | { mode: "zone"; level?: "dept" | "region" };

type PatchBody = {
  /** Présent → toggle de statut (pause/relance). Absent → édition. */
  status?: string;
  /** Lien Vitrine (https) — seulement si l'option est déjà souscrite. */
  websiteUrl?: string | null;
  /** Tranches d'âge — doit ÉLARGIR la sélection courante. */
  ages?: string[];
  /** Élargissement géo — voir classifyGeoWiden. */
  geo?: EditGeoBody;
  /** Niveau de vérification minimum — ABAISSER seulement (p2→p1→p0). */
  verifLevel?: string;
  /** Seuil de fiabilité minimum (0/60/80) — BAISSER seulement. */
  minFiabilite?: number;
};

/** Validation/normalisation de l'URL Vitrine — https UNIQUEMENT.
 *  Miroir de `normalizeWebsiteUrl` de app/api/pro/campaigns/route.ts (le
 *  lien est validé à la création ; on applique exactement la même règle à
 *  l'édition). */
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

/**
 * Branche ÉDITION du PATCH : applique uniquement des ÉLARGISSEMENTS sur une
 * campagne non clôturée (active ou en pause). Ne déclenche aucun re-matching
 * ni débit — seuls les critères stockés (`targeting`) et le lien Vitrine
 * sont mis à jour. Garde-fous « élargir-seulement » dans edit-targeting.ts.
 */
async function handleCampaignEdit(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  proId: string,
  id: string,
  body: PatchBody,
): Promise<NextResponse> {
  const { data: camp, error: readErr } = await admin
    .from("campaigns")
    .select("id, status, pro_account_id, targeting, website_url")
    .eq("id", id)
    .single();
  if (readErr || !camp) {
    return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
  }
  if (camp.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Édition autorisée tant que la campagne n'est pas clôturée.
  if (camp.status !== "active" && camp.status !== "paused") {
    return NextResponse.json({ error: "campaign_closed" }, { status: 409 });
  }

  const targeting = (camp.targeting as Targeting | null) ?? {};
  const nextTargeting: Targeting = { ...targeting };
  type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"];
  const updates: CampaignUpdate = {};
  let touchedTargeting = false;
  let touched = false;

  // 1) Lien Vitrine — uniquement si l'option a déjà été souscrite sur cette
  //    campagne (website_url non nul). Mise à jour du lien sans nouveau débit.
  if (Object.prototype.hasOwnProperty.call(body, "websiteUrl")) {
    if (!camp.website_url) {
      return NextResponse.json({ error: "vitrine_not_subscribed" }, { status: 403 });
    }
    const normalized = normalizeWebsiteUrl(body.websiteUrl);
    if (!normalized) {
      return NextResponse.json({ error: "invalid_website" }, { status: 400 });
    }
    updates.website_url = normalized;
    touched = true;
  }

  // 2) Tranche d'âge — élargir seulement (sur-ensemble du courant).
  if (Array.isArray(body.ages)) {
    const res = validateAgesWiden(targeting.ages ?? [], body.ages);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 409 });
    }
    nextTargeting.ages = res.ages;
    touchedTargeting = true;
    touched = true;
  }

  // 3) Zone géographique — élargir seulement.
  if (body.geo && typeof body.geo === "object") {
    const g = body.geo;
    const req: GeoWidenRequest =
      g.mode === "around"
        ? { mode: "around", radiusKm: Number(g.radiusKm) }
        : g.mode === "zone"
          ? { mode: "zone", level: g.level as "dept" | "region" }
          : { mode: "national" };
    const cls = classifyGeoWiden(targeting.geo ?? "", targeting.radiusKm ?? null, req);
    if (!cls.ok) {
      return NextResponse.json({ error: cls.error }, { status: 409 });
    }
    const plan = cls.plan;
    if (plan.kind === "national") {
      nextTargeting.geo = "national";
      nextTargeting.geoTarget = null;
      nextTargeting.radiusKm = null;
    } else if (plan.kind === "around") {
      nextTargeting.geo = "around";
      nextTargeting.radiusKm = plan.radiusKm;
      nextTargeting.geoTarget = null;
    } else {
      // Zone fixe élargie : dériver le geoTarget côté serveur depuis l'ancre
      // courante (repli sur le CP du pro pour les campagnes legacy sans cible).
      const { data: pro } = await admin
        .from("pro_accounts")
        .select("code_postal")
        .eq("id", proId)
        .single();
      const target = await buildWidenedGeoTarget(
        plan.level,
        targeting.geoTarget ?? null,
        pro?.code_postal ?? null,
      );
      if (!target) {
        return NextResponse.json({ error: "geo_resolve_failed" }, { status: 502 });
      }
      nextTargeting.geo = plan.level;
      nextTargeting.geoTarget = target;
      nextTargeting.radiusKm = null;
    }
    touchedTargeting = true;
    touched = true;
  }

  // 4) Niveau de vérification minimum — abaisser l'exigence seulement.
  if (typeof body.verifLevel === "string") {
    const cls = classifyVerifWiden(targeting.verifLevel ?? "p0", body.verifLevel);
    if (!cls.ok) {
      return NextResponse.json({ error: cls.error }, { status: 409 });
    }
    nextTargeting.verifLevel = body.verifLevel;
    touchedTargeting = true;
    touched = true;
  }

  // 5) Fiabilité minimum — baisser le seuil seulement.
  if (body.minFiabilite != null) {
    const cls = classifyFiabiliteWiden(targeting.minFiabilite ?? 0, Number(body.minFiabilite));
    if (!cls.ok) {
      return NextResponse.json({ error: cls.error }, { status: 409 });
    }
    nextTargeting.minFiabilite = cls.value;
    touchedTargeting = true;
    touched = true;
  }

  if (!touched) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }
  if (touchedTargeting) {
    updates.targeting = nextTargeting as unknown as CampaignUpdate["targeting"];
  }

  const { error: updErr } = await admin
    .from("campaigns")
    .update(updates)
    .eq("id", id)
    .in("status", ["active", "paused"]); // garde TOCTOU : pas clôturée entre-temps
  if (updErr) {
    console.error("[/api/pro/campaigns/PATCH edit] update failed", updErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // Si la cible a été ÉLARGIE (géo/âge), on sollicite les prospects désormais
  // éligibles mais pas encore contactés, dans la limite du quota déjà payé
  // (aucun débit supplémentaire). Pas de re-match pour une simple édition du
  // lien Vitrine. Best-effort : un échec ne fait pas échouer l'enregistrement.
  let resolicited = 0;
  if (touchedTargeting) {
    try {
      const r = await resolicitNewlyEligible(admin, id, proId);
      resolicited = r.added;
    } catch (e) {
      console.error("[/api/pro/campaigns/PATCH edit] resolicit failed", e);
    }
  }

  return NextResponse.json({
    ok: true,
    websiteUrl: (updates.website_url as string | undefined) ?? camp.website_url ?? null,
    geo: nextTargeting.geo ?? null,
    geoLabel: nextTargeting.geo ? GEO_LABEL[nextTargeting.geo] ?? nextTargeting.geo : "—",
    radiusKm: typeof nextTargeting.radiusKm === "number" ? nextTargeting.radiusKm : null,
    ages: nextTargeting.ages ?? [],
    verifLevel: nextTargeting.verifLevel ?? null,
    minFiabilite: typeof nextTargeting.minFiabilite === "number" ? nextTargeting.minFiabilite : 0,
    // Nombre de prospects nouvellement sollicités suite à l'élargissement.
    resolicited,
  });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  let body: PatchBody;
  try { body = (await req.json()) as PatchBody; }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  const admin = createSupabaseAdminClient();

  // ── Branche ÉDITION (élargissement d'une campagne en cours) ──────────
  // Sans champ `status`, le PATCH édite les 3 seuls points élargissables
  // (lien Vitrine, zone géo, âge). Aucun re-matching n'est déclenché : on
  // ne fait que mettre à jour les critères stockés (cf. handleCampaignEdit).
  if (body.status === undefined) {
    return handleCampaignEdit(admin, proId, id, body);
  }

  if (body.status !== "active" && body.status !== "paused") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const targetStatus = body.status;
  const { data: camp, error: readErr } = await admin
    .from("campaigns")
    .select(
      "id, status, ends_at, pro_account_id, targeting, paused_at, pause_used",
    )
    .eq("id", id)
    .single();
  if (readErr || !camp) {
    return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
  }
  if (camp.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const valid =
    (camp.status === "active" && targetStatus === "paused") ||
    (camp.status === "paused" && targetStatus === "active");
  if (!valid) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 409 });
  }

  const PAUSE_WINDOW_MS = 48 * 60 * 60 * 1000;
  const nowMs = Date.now();

  // ─── PAUSE ──────────────────────────────────────────────────────
  // Disponible pour toutes les durées (1h, 24h, 48h, 7d). Une seule
  // pause autorisée par campagne. À la pause, on enregistre `paused_at`
  // + `auto_resume_at = paused_at + 48h`, et on flag `pause_used=true`.
  // ends_at n'est PAS modifié immédiatement : il sera décalé du temps
  // réellement passé en pause au moment de la reprise (manuelle ou
  // automatique).
  if (targetStatus === "paused") {
    if (camp.pause_used) {
      return NextResponse.json({ error: "pause_already_used" }, { status: 409 });
    }
    const pausedAt = new Date(nowMs).toISOString();
    const autoResumeAt = new Date(nowMs + PAUSE_WINDOW_MS).toISOString();
    const { error: updateErr } = await admin
      .from("campaigns")
      .update({
        status: "paused",
        paused_at: pausedAt,
        auto_resume_at: autoResumeAt,
        pause_used: true,
      })
      .eq("id", id)
      .eq("status", "active"); // TOCTOU guard
    if (updateErr) {
      console.error("[/api/pro/campaigns/PATCH pause] update failed", updateErr);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      status: "paused",
      pausedAt,
      autoResumeAt,
      pauseUsed: true,
    });
  }

  // ─── RESUME ────────────────────────────────────────────────────
  // Manuelle (avant les 48 h). On préserve le temps restant : ends_at
  // est décalé de la durée effective de la pause (now - paused_at).
  if (!camp.paused_at) {
    return NextResponse.json({ error: "missing_paused_at" }, { status: 500 });
  }
  const pausedMs = new Date(camp.paused_at).getTime();
  const pauseDurationMs = Math.max(0, Math.min(PAUSE_WINDOW_MS, nowMs - pausedMs));
  const newEndsAt = camp.ends_at
    ? new Date(new Date(camp.ends_at).getTime() + pauseDurationMs).toISOString()
    : null;
  const { error: updateErr } = await admin
    .from("campaigns")
    .update({
      status: "active",
      paused_at: null,
      auto_resume_at: null,
      ...(newEndsAt ? { ends_at: newEndsAt } : {}),
    })
    .eq("id", id)
    .eq("status", "paused"); // TOCTOU guard
  if (updateErr) {
    console.error("[/api/pro/campaigns/PATCH resume] update failed", updateErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    status: "active",
    endsAt: newEndsAt,
    pauseDurationMs,
  });
}
