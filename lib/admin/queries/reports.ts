/**
 * Queries pour la page admin `/buupp-admin/signalements`.
 *
 * - fetchReportsList : liste filtrée (statut, motif, période) + pagination.
 * - fetchReportsKpis : 3 chiffres (à traiter, traités 30j, total période)
 *   + répartition par motif sur la même période.
 *
 * Tout en lecture pure depuis Supabase service_role. Pas de RPC : volumes
 * faibles, agrégation côté SQL via .select(count) suffit.
 *
 * NOTE : les types Supabase générés ne contiennent pas encore
 * `relation_reports` (migration appliquée manuellement). On cast en `any`
 * — à nettoyer dès régénération des types.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type ReportStatus = "open" | "resolved" | "all";
export type ReportReason =
  | "all"
  | "sollicitation_multiple"
  | "faux_compte"
  | "echange_abusif";
export type ReportPeriod = "7d" | "30d" | "90d" | "all";

export type ReportListItem = {
  id: string;
  reason: Exclude<ReportReason, "all">;
  comment: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByClerkId: string | null;
  resolvedNote: string | null;
  pro: {
    id: string;
    raisonSociale: string;
  } | null;
  prospect: {
    id: string;
    prenom: string | null;
    nomInitial: string | null;
  } | null;
  campaign: {
    id: string;
    name: string;
  } | null;
  relation: {
    id: string;
    sentAt: string;
    motif: string;
  } | null;
};

export type ReportsKpis = {
  open: number;
  resolved30d: number;
  totalPeriod: number;
  byReason: {
    sollicitation_multiple: number;
    faux_compte: number;
    echange_abusif: number;
  };
};

function periodCutoffIso(period: ReportPeriod): string | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const PAGE_SIZE = 50;

export async function fetchReportsList(opts: {
  status: ReportStatus;
  reason: ReportReason;
  period: ReportPeriod;
  page: number;
}): Promise<ReportListItem[]> {
  const admin = createSupabaseAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (admin as any)
    .from("relation_reports")
    .select(
      `id, reason, comment, created_at, resolved_at, resolved_by_clerk_id, resolved_note,
       pro_accounts ( id, raison_sociale ),
       prospects ( id, prenom, nom ),
       relations ( id, sent_at, motif, campaign_id, campaigns ( id, name ) )`,
    )
    .order("created_at", { ascending: false });

  if (opts.status === "open") {
    q = q.is("resolved_at", null);
  } else if (opts.status === "resolved") {
    q = q.not("resolved_at", "is", null);
  }
  if (opts.reason !== "all") {
    q = q.eq("reason", opts.reason);
  }
  const cutoff = periodCutoffIso(opts.period);
  if (cutoff) {
    q = q.gte("created_at", cutoff);
  }
  const from = opts.page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error } = await q.range(from, to);
  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    id: r.id,
    reason: r.reason,
    comment: r.comment ?? null,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at ?? null,
    resolvedByClerkId: r.resolved_by_clerk_id ?? null,
    resolvedNote: r.resolved_note ?? null,
    pro: r.pro_accounts
      ? {
          id: r.pro_accounts.id,
          raisonSociale: r.pro_accounts.raison_sociale ?? "—",
        }
      : null,
    prospect: r.prospects
      ? {
          id: r.prospects.id,
          prenom: r.prospects.prenom ?? null,
          nomInitial:
            typeof r.prospects.nom === "string" && r.prospects.nom.length > 0
              ? r.prospects.nom[0].toUpperCase() + "."
              : null,
        }
      : null,
    campaign: r.relations?.campaigns
      ? {
          id: r.relations.campaigns.id,
          name: r.relations.campaigns.name ?? "—",
        }
      : null,
    relation: r.relations
      ? {
          id: r.relations.id,
          sentAt: r.relations.sent_at,
          motif: r.relations.motif ?? "",
        }
      : null,
  }));
}

export async function fetchReportsKpis(opts: {
  period: ReportPeriod;
}): Promise<ReportsKpis> {
  const admin = createSupabaseAdminClient();
  const cutoff = periodCutoffIso(opts.period);
  const cutoff30d = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseCount = (filterFn: (q: any) => any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (admin as any)
      .from("relation_reports")
      .select("id", { count: "exact", head: true });
    q = filterFn(q);
    if (cutoff) q = q.gte("created_at", cutoff);
    return q;
  };

  const [openRes, resolved30dRes, totalRes, multRes, fauxRes, abusRes] =
    await Promise.all([
      baseCount((q) => q.is("resolved_at", null)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any)
        .from("relation_reports")
        .select("id", { count: "exact", head: true })
        .not("resolved_at", "is", null)
        .gte("resolved_at", cutoff30d),
      baseCount((q) => q),
      baseCount((q) => q.eq("reason", "sollicitation_multiple")),
      baseCount((q) => q.eq("reason", "faux_compte")),
      baseCount((q) => q.eq("reason", "echange_abusif")),
    ]);

  return {
    open: openRes.count ?? 0,
    resolved30d: resolved30dRes.count ?? 0,
    totalPeriod: totalRes.count ?? 0,
    byReason: {
      sollicitation_multiple: multRes.count ?? 0,
      faux_compte: fauxRes.count ?? 0,
      echange_abusif: abusRes.count ?? 0,
    },
  };
}
