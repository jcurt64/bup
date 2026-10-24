/**
 * Option de campagne « Exclure les prospects ayant déjà accepté une de mes
 * campagnes » (`targeting.excludePastAcceptors`).
 *
 * Règle (unique, partagée par le matching, la re-sollicitation, le reach
 * filleuls et le backstop à l'acceptation) : un prospect est un « ancien
 * acceptant » d'un pro s'il a une relation avec le MÊME `pro_account_id`
 * (sur une AUTRE campagne) en statut `accepted` ou `settled`, décidée dans
 * les 12 derniers mois.
 *
 * Quand l'option est active, ces prospects ne reçoivent jamais la
 * sollicitation (aucune relation créée, ni mail ni push). Le pro ne paie
 * donc pas deux fois le même contact.
 *
 * Absent du JSON `targeting` ⇒ false (rétro-compat, aucune migration).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Fenêtre glissante de la règle, en mois. */
export const PAST_ACCEPTOR_WINDOW_MONTHS = 12;

/** Statuts de relation qui valent « a déjà accepté ». */
export const PAST_ACCEPTOR_STATUSES = ["accepted", "settled"] as const;

/** Objectifs pour lesquels l'option est cochée par défaut dans le wizard. */
export const EXCLUDE_PAST_ACCEPTORS_DEFAULT_OBJECTIVES = ["contact", "rdv"] as const;

export const ALREADY_ACCEPTED_PRO_ERROR = "already_accepted_pro";
export const ALREADY_ACCEPTED_PRO_MESSAGE =
  "Vous avez déjà accepté une campagne de ce professionnel : cette offre ne vous est pas destinée.";

/** Valeur par défaut de l'option selon l'objectif de campagne. */
export function defaultExcludePastAcceptors(objectiveId: string | null | undefined): boolean {
  return (EXCLUDE_PAST_ACCEPTORS_DEFAULT_OBJECTIVES as readonly string[]).includes(
    String(objectiveId ?? ""),
  );
}

/** Lit l'option depuis le JSON `targeting` (défensif : seul `true` active). */
export function excludesPastAcceptors(
  targeting: Record<string, unknown> | null | undefined,
): boolean {
  return targeting?.excludePastAcceptors === true;
}

/** Date plancher (ISO) de la fenêtre : now − 12 mois. */
export function pastAcceptorCutoffIso(now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setMonth(d.getMonth() - PAST_ACCEPTOR_WINDOW_MONTHS);
  return d.toISOString();
}

export type PastAcceptorRelationRow = {
  status: string | null;
  decided_at: string | null;
  campaign_id: string | null;
};

/**
 * Prédicat pur : la relation fait-elle de son prospect un ancien acceptant ?
 * (statut accepted/settled, décidée après `cutoffIso`, autre campagne que
 * `excludeCampaignId`). La contrainte « même pro » est portée par la requête.
 */
export function isPastAcceptorRelation(
  row: PastAcceptorRelationRow,
  opts: { cutoffIso: string; excludeCampaignId?: string | null },
): boolean {
  if (!row.status || !(PAST_ACCEPTOR_STATUSES as readonly string[]).includes(row.status)) {
    return false;
  }
  if (!row.decided_at) return false;
  const decided = new Date(row.decided_at).getTime();
  const cutoff = new Date(opts.cutoffIso).getTime();
  if (Number.isNaN(decided) || Number.isNaN(cutoff) || decided < cutoff) return false;
  if (opts.excludeCampaignId && row.campaign_id === opts.excludeCampaignId) return false;
  return true;
}

const PAGE_SIZE = 1000;

/**
 * Ensemble des prospect_id ayant déjà accepté une campagne de ce pro dans
 * les 12 derniers mois (hors `excludeCampaignId`). Service_role requis
 * (lecture transverse des relations du pro). Paginé (limite PostgREST).
 */
export async function pastAcceptorProspectIds(
  admin: SupabaseClient<Database>,
  proAccountId: string,
  excludeCampaignId?: string | null,
  now: Date = new Date(),
): Promise<Set<string>> {
  const cutoffIso = pastAcceptorCutoffIso(now);
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    let q = admin
      .from("relations")
      .select("prospect_id, status, decided_at, campaign_id")
      .eq("pro_account_id", proAccountId)
      .in("status", [...PAST_ACCEPTOR_STATUSES])
      .gte("decided_at", cutoffIso)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (excludeCampaignId) q = q.neq("campaign_id", excludeCampaignId);
    const { data, error } = await q;
    if (error) throw error;
    const rows = data ?? [];
    for (const r of rows) {
      if (r.prospect_id && isPastAcceptorRelation(r, { cutoffIso, excludeCampaignId })) {
        ids.add(r.prospect_id);
      }
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return ids;
}

/**
 * Backstop à l'acceptation : ce prospect a-t-il déjà accepté une AUTRE
 * campagne de ce pro dans les 12 derniers mois ?
 */
export async function hasAcceptedProRecently(
  admin: SupabaseClient<Database>,
  opts: { prospectId: string; proAccountId: string; campaignId: string; now?: Date },
): Promise<boolean> {
  const cutoffIso = pastAcceptorCutoffIso(opts.now ?? new Date());
  const { data, error } = await admin
    .from("relations")
    .select("status, decided_at, campaign_id")
    .eq("prospect_id", opts.prospectId)
    .eq("pro_account_id", opts.proAccountId)
    .in("status", [...PAST_ACCEPTOR_STATUSES])
    .gte("decided_at", cutoffIso)
    .neq("campaign_id", opts.campaignId)
    .limit(5);
  if (error) throw error;
  return (data ?? []).some((r) =>
    isPastAcceptorRelation(r, { cutoffIso, excludeCampaignId: opts.campaignId }),
  );
}
