import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeContacts, type RelationInput } from "./decode";
import type { SegmentContact, TierKey } from "./types";

export type CampaignAudience = {
  status: string | null;
  proAccountId: string | null;
  /** Toujours ["identity"] depuis le pivot « mise en relation ». */
  allowedTiers: TierKey[];
  contacts: SegmentContact[];
};

/** Charge les contacts acceptés/settled d'une campagne (prénom + initiale).
 *  NE vérifie PAS l'ownership ni la clôture : c'est à la route appelante de
 *  gater (proAccountId / status renvoyés pour ça). */
export async function loadCampaignAudience(
  admin: SupabaseClient,
  campaignId: string,
): Promise<CampaignAudience | null> {
  const { data: camp } = await admin
    .from("campaigns")
    .select("id, status, pro_account_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!camp) return null;

  const { data: rels } = await admin
    .from("relations")
    .select("id, evaluation, prospects:prospect_id ( id, bupp_score )")
    .eq("campaign_id", campaignId)
    .in("status", ["accepted", "settled"]);

  const relations: RelationInput[] = [];
  for (const r of (rels ?? []) as Array<{
    id: string;
    evaluation: "atteint" | "non_atteint" | null;
    prospects: { id: string; bupp_score: number | null } | { id: string; bupp_score: number | null }[] | null;
  }>) {
    const p = Array.isArray(r.prospects) ? r.prospects[0] : r.prospects;
    if (!p) continue;
    relations.push({ relationId: r.id, prospectId: p.id, score: p.bupp_score ?? 0, evaluation: r.evaluation ?? null });
  }

  const prospectIds = relations.map((r) => r.prospectId);
  const identityByProspect = new Map<string, Record<string, unknown>>();
  if (prospectIds.length > 0) {
    const { data: rows } = await admin
      .from("prospect_identity")
      .select("prospect_id, prenom, nom")
      .in("prospect_id", prospectIds);
    for (const row of (rows ?? []) as unknown as Array<Record<string, unknown>>) {
      identityByProspect.set(String(row.prospect_id), row);
    }
  }

  const contacts = decodeContacts({ relations, identityByProspect });
  return {
    status: (camp.status as string | null) ?? null,
    proAccountId: (camp.pro_account_id as string | null) ?? null,
    allowedTiers: ["identity"],
    contacts,
  };
}
