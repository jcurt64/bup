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
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { objectiveLabel } from "@/lib/campaigns/mapping";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type Targeting = {
  objectiveId?: string;
  subTypes?: string[];
  requiredTiers?: number[];
  requiredTierKeys?: string[];
  geo?: string;
  ages?: string[];
  verifLevel?: string;
  keywords?: string[];
  kwFilter?: boolean;
  poolMode?: string;
  days?: number;
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
  p1: "Vérifié — palier 1",
  p2: "Certifié — palier 2",
  p3: "Confiance — palier 3",
};

const GEO_LABEL: Record<string, string> = {
  ville: "Ville (rayon 20 km)",
  dept: "Département",
  region: "Région",
  national: "National",
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

export async function GET(_req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();

  const { data: camp, error: campErr } = await admin
    .from("campaigns")
    .select(
      `id, name, status, brief, targeting,
       budget_cents, spent_cents, cost_per_contact_cents, matched_count,
       starts_at, ends_at, created_at, pro_account_id`,
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
  const acceptanceRate = decidedCount > 0
    ? Math.round((winCount / decidedCount) * 1000) / 10
    : null;

  // Liste des contacts : seulement les relations gagnées (accepted/settled),
  // joint sur l'identité prospect pour afficher prénom + nom + score.
  const contacts = rows
    .filter((r) => r.status === "accepted" || r.status === "settled")
    .slice(0, 50)
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
      };
    });

  // Activity feed : derniers événements ordonnés par "date la plus récente"
  // (settled_at > decided_at > sent_at). Limité à 20 lignes.
  const activity = rows
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
      ages: targeting?.ages ?? [],
      verifLevel: targeting?.verifLevel ?? null,
      verifLabel: targeting?.verifLevel ? VERIF_LEVEL_LABEL[targeting.verifLevel] ?? targeting.verifLevel : "—",
      keywords: targeting?.keywords ?? [],
      kwFilter: !!targeting?.kwFilter,
      poolMode: targeting?.poolMode ?? null,
      poolLabel: targeting?.poolMode ? POOL_LABEL[targeting.poolMode] ?? targeting.poolMode : "—",
      days: targeting?.days ?? null,
    },
    funnel,
    acceptanceRate,
    winCount,
    contacts,
    activity,
  });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  let body: { status?: string };
  try { body = (await req.json()) as { status?: string }; }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  if (body.status !== "active" && body.status !== "paused") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const targetStatus = body.status;

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const { data: camp, error: readErr } = await admin
    .from("campaigns")
    .select("id, status, ends_at, pro_account_id")
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
  if (targetStatus === "active" && camp.ends_at && new Date(camp.ends_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "campaign_expired" }, { status: 410 });
  }

  const { error: updateErr } = await admin
    .from("campaigns")
    .update({ status: targetStatus })
    .eq("id", id)
    .eq("status", camp.status); // TOCTOU guard
  if (updateErr) {
    console.error("[/api/pro/campaigns/PATCH] update failed", updateErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: targetStatus });
}
