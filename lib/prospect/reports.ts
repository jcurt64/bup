/**
 * Helper partagé : retourne l'ensemble des `relation_id` déjà signalés
 * par un prospect, parmi une liste donnée.
 *
 * Appelé par `GET /api/prospect/relations` pour annoter chaque relation
 * du flag `reported: boolean` consommé par la modale prospect.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function reportedRelationIds(
  admin: SupabaseClient,
  prospectId: string,
  relationIds: string[],
): Promise<Set<string>> {
  if (relationIds.length === 0) return new Set();
  const { data, error } = await admin
    .from("relation_reports")
    .select("relation_id")
    .eq("prospect_id", prospectId)
    .in("relation_id", relationIds);
  if (error || !data) return new Set();
  return new Set(data.map((r: { relation_id: string }) => r.relation_id));
}
