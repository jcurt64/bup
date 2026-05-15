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
  geoRadiusFloorKm,
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
  /** Quand true, retire les prospects `certifie_confiance` du pool —
   *  le pro a explicitement décoché ce palier dans le wizard. */
  excludeCertified?: boolean;
};

export type MatchedProspect = {
  prospectId: string;
  email: string | null;
  prenom: string | null;
  /** Niveau de vérification au moment du match. Sert à appliquer le
   *  bonus ×2 sur la récompense quand le prospect est `certifie_confiance`. */
  verification: "basique" | "verifie" | "certifie_confiance";
};

export async function findMatchingProspects(
  admin: SupabaseClient<Database>,
  input: MatchingInput,
): Promise<MatchedProspect[]> {
  const requiredKeys = tierNumsToKeys(input.requiredTiers);
  let acceptableLevels = acceptableVerifLevels(input.verifLevel);
  if (input.excludeCertified) {
    // Retire `certifie_confiance` du pool : le pro a explicitement
    // demandé à exclure ce palier (ex. pour limiter le doublage de gain).
    acceptableLevels = acceptableLevels.filter(
      (l) => l !== "certifie_confiance",
    );
  }
  const cpPrefix = geoCodePostalPrefix(input.geo, input.proCodePostal);
  // Plancher de rayon : un prospect doit avoir réglé son rayon
  // (`prospect_localisation.targeting_radius_km`) >= ce plancher pour
  // accepter une campagne de la portée demandée. Null = national → on
  // ne filtre pas, le prospect reçoit même avec un rayon de 5 km.
  const radiusFloorKm = geoRadiusFloorKm(input.geo);
  const ageBounds = ageRangesToBounds(input.ages);
  const wantsTier1 = input.requiredTiers.includes(1);
  const campaignType: CampaignTypeDb = objectiveToCampaignType(input.objectiveId);

  // Sur-fetch ×3 quand on filtre par âge côté Node, pour avoir une marge
  // si beaucoup de prospects matchent les autres critères mais pas l'âge.
  // Quand cette marge ne suffit pas, l'appelant doit accepter un résultat
  // plus court que `contacts` sans considérer ça comme une erreur.
  const oversampleFactor = ageBounds && wantsTier1 ? 3 : 1;
  const selectLimit = input.contacts * oversampleFactor;

  let query = admin
    .from("prospects")
    .select(
      `
      id,
      verification,
      removed_tiers,
      hidden_tiers,
      prospect_identity ( email, prenom, naissance ),
      prospect_localisation ( code_postal, targeting_radius_km, national_opt_in )
    `,
    )
    .in("verification", acceptableLevels)
    .order("bupp_score", { ascending: false })
    .order("id", { ascending: true })
    .limit(selectLimit);

  // Filtre type campagne : `all_campaign_types=true OR enum dans campaign_types`.
  // ⚠ campaignType DOIT venir de `objectiveToCampaignType` (enum literal).
  // Ne JAMAIS interpoler une chaîne libre ici — risque d'injection PostgREST.
  query = query.or(
    `all_campaign_types.eq.true,campaign_types.cs.{${campaignType}}`,
  );

  // ⚠ Plus de `query.like("prospect_localisation.code_postal", cpPrefix)` :
  // ce filtre PostgREST ne filtrait que l'embed (nullify la localisation
  // si CP non matché), pas le parent. On le perdait au profit du check JS
  // ci-dessous. Désormais on ramène tout, et le filtre CP/national est
  // appliqué en JS pour pouvoir gérer `national_opt_in=true` (bypass).
  // Le préfixe est rendu plus strict côté JS via `startsWith` (le `%` du
  // pattern PostgREST n'est plus pertinent).
  const cpPrefixRaw = cpPrefix ? cpPrefix.replace(/%$/, "") : null;

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
    // (Les deux relations sont isOneToOne → typés `T | null` directement.)
    const identity = row.prospect_identity;
    if (requiredKeys.includes("identity") && !identity) continue;

    const localisation = row.prospect_localisation;
    const nationalOptIn = localisation?.national_opt_in === true;

    // Filtre CP : le prospect doit habiter dans le département ciblé,
    // SAUF s'il a coché « Étendre au niveau national » dans ses
    // préférences (auquel cas il est éligible quelle que soit la
    // portée du pro). Pour les campagnes nationales, cpPrefixRaw est
    // déjà null donc on n'entre pas dans cette branche.
    if (cpPrefixRaw && !nationalOptIn) {
      const cp = localisation?.code_postal;
      if (!cp || !cp.startsWith(cpPrefixRaw)) continue;
    }

    // Filtre rayon prospect : le prospect doit avoir réglé son rayon
    // de ciblage >= au plancher imposé par la portée de la campagne.
    // Le flag « national » l'exempte aussi de ce plancher (sémantique
    // « j'accepte n'importe où »). Si la row palier 2 (localisation)
    // n'existe pas, on suppose le default DB (25 km) — cohérent avec
    // le check constraint.
    if (radiusFloorKm != null && !nationalOptIn) {
      const prospectRadius = localisation?.targeting_radius_km ?? 25;
      if (prospectRadius < radiusFloorKm) continue;
    }

    // Filtre âge — uniquement applicable si tier 1 requis (sinon on ne
    // peut pas connaître la naissance, on laisse passer).
    if (ageBounds && wantsTier1) {
      const age = ageFromBirthString(identity?.naissance ?? null);
      if (age == null) continue;
      if (!ageMatchesAny(age, ageBounds)) continue;
    }

    matched.push({
      prospectId: row.id,
      email: identity?.email ?? null,
      prenom: identity?.prenom ?? null,
      verification: row.verification as MatchedProspect["verification"],
    });
  }

  return matched;
}
