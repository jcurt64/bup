/**
 * GET /api/pro/campaigns/[id]/statement — relevé PDF d'une campagne.
 *
 * Alimente le bouton « Relevé complet » de l'onglet Facturation du détail
 * de campagne (Pro.jsx). Récapitule les débits de la campagne : budget
 * consommé, commission BUUPP (10 %), total débité, contacts facturés.
 *
 * Gating séquestre : les identités prospect ne sont incluses dans le PDF
 * que si la campagne est clôturée (status='completed'), en parité avec
 * GET /api/pro/campaigns/[id] (cf. proCanSeeContacts). Avant clôture, le
 * relevé ne contient que les agrégats + un libellé d'indisponibilité.
 *
 * Auth : seul le pro propriétaire de la campagne y a accès (404 sinon, on
 * ne révèle pas l'existence).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { objectiveLabel } from "@/lib/campaigns/mapping";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";
import {
  buildCampaignStatementPdf,
  type CampaignStatementContact,
  type CampaignStatementData,
  type ProBillingInfo,
} from "@/lib/invoices/pdf";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type Targeting = {
  objectiveId?: string;
  requiredTiers?: number[];
} | null;

const TIER_NUM_TO_LABEL: Record<number, string> = {
  1: "P1 · Identification",
  2: "P2 · Localisation",
  3: "P3 · Style de vie",
  4: "P4 · Vie pro",
  5: "P5 · Patrimoine",
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40) || "campagne";
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

  const [{ data: camp, error: campErr }, { data: pro, error: proErr }] = await Promise.all([
    admin
      .from("campaigns")
      .select(
        `id, name, status, targeting, budget_cents, spent_cents,
         cost_per_contact_cents, starts_at, ends_at, created_at, pro_account_id`,
      )
      .eq("id", id)
      .single(),
    admin
      .from("pro_accounts")
      .select("raison_sociale, adresse, ville, code_postal, siren, secteur, forme_juridique, capital_social_cents, siret, rcs_ville, rm_number")
      .eq("id", proId)
      .single(),
  ]);

  if (campErr || !camp) {
    return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
  }
  // Cross-pro → 404 (on ne révèle pas l'existence d'une campagne tierce).
  if (camp.pro_account_id !== proId) {
    return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
  }
  if (proErr) {
    console.error("[/api/pro/campaigns/:id/statement] read pro failed", proErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const { data: rels, error: relErr } = await admin
    .from("relations")
    .select(
      `id, status, sent_at, decided_at, reward_cents, prospect_id,
       prospects ( bupp_score, prospect_identity ( prenom, nom ) )`,
    )
    .eq("campaign_id", id)
    .order("sent_at", { ascending: false });

  if (relErr) {
    console.error("[/api/pro/campaigns/:id/statement] read relations failed", relErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type RelationRow = {
    id: string;
    status: string;
    sent_at: string;
    decided_at: string | null;
    reward_cents: number | string;
    prospect_id: string;
    prospects: {
      prospect_identity: { prenom: string | null; nom: string | null } | null;
    } | null;
  };
  const rows = (rels ?? []) as unknown as RelationRow[];

  const wins = rows.filter((r) => r.status === "accepted" || r.status === "settled");
  const winCount = wins.length;

  const targeting = (camp.targeting as Targeting) ?? null;
  const tierLabel = (() => {
    const tiers = targeting?.requiredTiers;
    if (!Array.isArray(tiers) || tiers.length === 0) return "—";
    const max = Math.max(...tiers.map((n) => Number(n) || 0));
    return TIER_NUM_TO_LABEL[max] ?? "—";
  })();

  const budgetEur = Number(camp.budget_cents ?? 0) / 100;
  const spentEur = Number(camp.spent_cents ?? 0) / 100;
  const cpcEur = Number(camp.cost_per_contact_cents ?? 0) / 100;
  const avgCostEur = winCount > 0 ? Math.round((spentEur / winCount) * 100) / 100 : cpcEur;
  // Commission BUUPP = 10 % du consommé. Aligné sur l'onglet Facturation.
  const commissionSpentEur = Math.round(spentEur * 0.1 * 100) / 100;
  const totalDebitedEur = Math.round((spentEur + commissionSpentEur) * 100) / 100;
  const plannedContacts = cpcEur > 0 ? Math.round(budgetEur / cpcEur) : 0;

  const contactsUnlocked = proCanSeeContacts(camp.status);
  const contacts: CampaignStatementContact[] = contactsUnlocked
    ? wins.map((r) => {
        const ident = r.prospects?.prospect_identity ?? null;
        const fullName =
          [ident?.prenom?.trim(), ident?.nom?.trim()].filter(Boolean).join(" ") || "Prospect";
        return {
          name: fullName,
          tierLabel,
          decidedAt: r.decided_at ?? r.sent_at,
          amountEur: cpcEur,
          statusLabel: r.status === "settled" ? "Crédité" : "En séquestre",
        };
      })
    : [];

  const STATUS_LABELS: Record<string, string> = {
    active: "Active",
    paused: "En pause",
    completed: "Terminée",
    canceled: "Annulée",
    draft: "Brouillon",
  };

  const statement: CampaignStatementData = {
    campaignName: camp.name,
    objectiveLabel: objectiveLabel(targeting?.objectiveId),
    statusLabel: STATUS_LABELS[camp.status] ?? camp.status,
    createdAtLabel: fmtDate(camp.created_at),
    endsAtLabel: fmtDate(camp.ends_at),
    budgetEur,
    spentEur,
    commissionSpentEur,
    totalDebitedEur,
    winCount,
    plannedContacts,
    avgCostEur,
    contacts,
    contactsLocked: !contactsUnlocked,
  };

  const billing: ProBillingInfo = {
    raisonSociale: pro?.raison_sociale ?? "—",
    adresse: pro?.adresse ?? null,
    ville: pro?.ville ?? null,
    codePostal: pro?.code_postal ?? null,
    siren: pro?.siren ?? null,
    secteur: pro?.secteur ?? null,
    email,
    formeJuridique: pro?.forme_juridique ?? null,
    capitalSocialEur:
      pro?.capital_social_cents == null ? null : Number(pro.capital_social_cents) / 100,
    siret: pro?.siret ?? null,
    rcsVille: pro?.rcs_ville ?? null,
    rmNumber: pro?.rm_number ?? null,
  };

  const buf = await buildCampaignStatementPdf(statement, billing);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="releve-campagne-${slug(camp.name)}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
