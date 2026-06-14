import type { SupabaseClient } from "@supabase/supabase-js";
import { tierNumsToKeys } from "@/lib/campaigns/mapping";
import { decodeContacts, type RelationInput } from "./decode";
import type { SegmentContact, TierKey } from "./types";

const TIER_TABLE: Record<TierKey, string> = {
  identity: "prospect_identity",
  localisation: "prospect_localisation",
  vie: "prospect_vie",
  pro: "prospect_pro",
  patrimoine: "prospect_patrimoine",
};

const TIER_COLS: Record<TierKey, string> = {
  identity: "prospect_id, prenom, nom",
  localisation: "prospect_id, region, ville, code_postal, adresse, center_distance_m",
  vie: "prospect_id, foyer, sports, animaux, vehicule, logement, mobilite",
  pro: "prospect_id, poste, statut, secteur, revenus",
  patrimoine: "prospect_id, residence, epargne, projets",
};

export type CampaignAudience = {
  status: string | null;
  proAccountId: string | null;
  allowedTiers: TierKey[];
  contacts: SegmentContact[];
};

/** Charge les contacts acceptés/settled d'une campagne, décodés sur les
 *  paliers achetés (requiredTiers) et hors paliers masqués/supprimés par
 *  chaque prospect. NE vérifie PAS l'ownership ni la clôture : c'est à la
 *  route appelante de gater (proAccountId / status renvoyés pour ça). */
export async function loadCampaignAudience(
  admin: SupabaseClient,
  campaignId: string,
): Promise<CampaignAudience | null> {
  const { data: camp } = await admin
    .from("campaigns")
    .select("id, status, pro_account_id, targeting")
    .eq("id", campaignId)
    .maybeSingle();
  if (!camp) return null;

  const requiredNums = ((camp.targeting as { requiredTiers?: number[] } | null)?.requiredTiers ?? [1]) as number[];
  const allowedTiers = tierNumsToKeys(requiredNums) as TierKey[];

  const { data: rels } = await admin
    .from("relations")
    .select("id, evaluation, prospects:prospect_id ( id, bupp_score, removed_tiers, hidden_tiers )")
    .eq("campaign_id", campaignId)
    .in("status", ["accepted", "settled"]);

  const relations: RelationInput[] = [];
  const blockedByProspect = new Map<string, Set<TierKey>>();
  for (const r of (rels ?? []) as Array<{
    id: string;
    evaluation: "atteint" | "non_atteint" | null;
    prospects: { id: string; bupp_score: number | null; removed_tiers: string[] | null; hidden_tiers: string[] | null }
      | { id: string; bupp_score: number | null; removed_tiers: string[] | null; hidden_tiers: string[] | null }[]
      | null;
  }>) {
    const p = Array.isArray(r.prospects) ? r.prospects[0] : r.prospects;
    if (!p) continue;
    relations.push({ relationId: r.id, prospectId: p.id, score: p.bupp_score ?? 0, evaluation: r.evaluation ?? null });
    blockedByProspect.set(
      p.id,
      new Set<TierKey>([...((p.removed_tiers ?? []) as TierKey[]), ...((p.hidden_tiers ?? []) as TierKey[])]),
    );
  }

  const prospectIds = relations.map((r) => r.prospectId);
  const tierData: Partial<Record<TierKey, Map<string, Record<string, unknown>>>> = {};
  if (prospectIds.length > 0) {
    for (const key of allowedTiers) {
      const { data: rows } = await admin.from(TIER_TABLE[key]).select(TIER_COLS[key]).in("prospect_id", prospectIds);
      const m = new Map<string, Record<string, unknown>>();
      for (const row of (rows ?? []) as unknown as Array<Record<string, unknown>>) {
        m.set(String(row.prospect_id), row);
      }
      tierData[key] = m;
    }
  }

  const contacts = decodeContacts({ relations, blockedByProspect, tierData, campaignTiers: allowedTiers });
  return {
    status: (camp.status as string | null) ?? null,
    proAccountId: (camp.pro_account_id as string | null) ?? null,
    allowedTiers,
    contacts,
  };
}
