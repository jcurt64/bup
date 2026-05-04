/**
 * Sélection des prospects qui matchent les critères d'une campagne.
 *
 * Appelé exclusivement depuis `POST /api/pro/campaigns` en service_role
 * (la requête lit en cross-prospect, ce que la RLS bloquerait).
 *
 * Implémentation : 1 SELECT principal + filtre âge appliqué côté Node
 * (la colonne `naissance` est `text`, parser en JS est plus simple
 * qu'une fonction SQL).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  acceptableVerifLevels,
  ageFromBirthString,
  ageMatchesAny,
  ageRangesToBounds,
  geoCodePostalPrefix,
  objectiveToCampaignType,
  tierNumsToKeys,
  type CampaignTypeDb,
} from "./mapping";

export type MatchingInput = {
  objectiveId: string;
  requiredTiers: number[];
  geo: string;
  proCodePostal: string | null;
  ages: string[];
  verifLevel: string;
  contacts: number;
};

export type MatchedProspect = {
  prospectId: string;
  email: string | null;
  prenom: string | null;
};

export async function findMatchingProspects(
  admin: SupabaseClient<Database>,
  input: MatchingInput,
): Promise<MatchedProspect[]> {
  const requiredKeys = tierNumsToKeys(input.requiredTiers);
  const acceptableLevels = acceptableVerifLevels(input.verifLevel);
  const cpPrefix = geoCodePostalPrefix(input.geo, input.proCodePostal);
  const ageBounds = ageRangesToBounds(input.ages);
  const wantsTier1 = input.requiredTiers.includes(1);
  const campaignType: CampaignTypeDb = objectiveToCampaignType(input.objectiveId);

  // SELECT principal — on sur-fetch un peu si on doit filtrer par âge
  // côté Node (×3 le cap) pour avoir de la marge.
  const oversampleFactor = ageBounds && wantsTier1 ? 3 : 1;
  const selectLimit = Math.max(input.contacts * oversampleFactor, input.contacts);

  let query = admin
    .from("prospects")
    .select(
      `
      id,
      bupp_score,
      verification,
      removed_tiers,
      hidden_tiers,
      all_campaign_types,
      campaign_types,
      prospect_identity ( email, prenom, naissance ),
      prospect_localisation ( code_postal )
    `,
    )
    .in("verification", acceptableLevels)
    .order("bupp_score", { ascending: false })
    .order("id", { ascending: true })
    .limit(selectLimit);

  // Filtre type campagne : `all_campaign_types=true OR enum dans campaign_types`
  query = query.or(
    `all_campaign_types.eq.true,campaign_types.cs.{${campaignType}}`,
  );

  if (cpPrefix) {
    query = query.like("prospect_localisation.code_postal", cpPrefix);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];

  const matched: MatchedProspect[] = [];
  for (const row of data) {
    if (matched.length >= input.contacts) break;

    // Tous les paliers requis doivent être présents et pas masqués/supprimés.
    const removed = (row.removed_tiers ?? []) as string[];
    const hidden = (row.hidden_tiers ?? []) as string[];
    const blocked = requiredKeys.some(
      (k) => removed.includes(k) || hidden.includes(k),
    );
    if (blocked) continue;

    // Le palier 1 (identity) doit avoir une row prospect_identity non vide
    // si on l'exige. Idem pour la localisation si geo != national.
    const identity = Array.isArray(row.prospect_identity)
      ? row.prospect_identity[0]
      : row.prospect_identity;
    if (requiredKeys.includes("identity") && !identity) continue;

    const localisation = Array.isArray(row.prospect_localisation)
      ? row.prospect_localisation[0]
      : row.prospect_localisation;
    if (cpPrefix && !localisation?.code_postal) continue;

    // Filtre âge — uniquement applicable si tier 1 requis (sinon on ne
    // peut pas connaître la naissance, on laisse passer).
    if (ageBounds && wantsTier1) {
      const age = ageFromBirthString(identity?.naissance ?? null);
      if (age == null) continue;
      if (!ageMatchesAny(age, ageBounds)) continue;
    }

    matched.push({
      prospectId: row.id as string,
      email: identity?.email ?? null,
      prenom: identity?.prenom ?? null,
    });
  }

  return matched;
}
