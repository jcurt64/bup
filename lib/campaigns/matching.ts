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
import { haversineMeters, type LatLng } from "@/lib/geo/geocode";

export type MatchingInput = {
  objectiveId: string;
  requiredTiers: number[];
  geo: string;
  /** Cible géographique précise choisie via l'autocomplete officiel
   *  geo.api.gouv.fr — quand présent, override la logique du préfixe
   *  CP-du-pro (`geoCodePostalPrefix`). Sécurité : le client envoie le
   *  shape brut, la route POST le passe à `normalizeGeoTarget` avant
   *  de le forwarder ici. */
  geoTarget?:
    | { type: "ville"; codesPostaux: string[] }
    | { type: "dept"; code: string }
    | { type: "region"; deptCodes: string[] }
    | null;
  proCodePostal: string | null;
  /** Coordonnées de l'établissement pro — requises pour `geo === "around"`
   *  (ciblage par rayon). Renseignées depuis pro_accounts.latitude/longitude
   *  (géocodage de l'adresse, cf. /api/pro/info). */
  proLat?: number | null;
  proLng?: number | null;
  /** Rayon (km) du ciblage « autour de moi ». Ignoré hors `geo === "around"`. */
  radiusKm?: number | null;
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
  // Cible géo précise (issue de l'autocomplete officiel) → la transformer
  // en règle de filtre CP côté JS. Sinon, retombe sur le préfixe basé
  // sur le CP du pro (legacy + cas where the pro didn't pick a target).
  const geoTarget = input.geoTarget ?? null;
  // `allowedExactCps` : CP exacts à matcher (pour le mode ville → 1-N CP).
  // `allowedPrefixes` : préfixes (chaque entrée matchée via startsWith)
  // pour dept (1 préfixe) ou region (N préfixes de tous les dépts).
  let allowedExactCps: Set<string> | null = null;
  let allowedPrefixes: string[] | null = null;
  if (geoTarget?.type === "ville") {
    allowedExactCps = new Set(geoTarget.codesPostaux);
  } else if (geoTarget?.type === "dept") {
    allowedPrefixes = [geoTarget.code];
  } else if (geoTarget?.type === "region") {
    allowedPrefixes = geoTarget.deptCodes;
  }
  const cpPrefix = geoTarget ? null : geoCodePostalPrefix(input.geo, input.proCodePostal);
  // Plancher de rayon : un prospect doit avoir réglé son rayon
  // (`prospect_localisation.targeting_radius_km`) >= ce plancher pour
  // accepter une campagne de la portée demandée. Null = national → on
  // ne filtre pas, le prospect reçoit même avec un rayon de 5 km.
  const radiusFloorKm = geoRadiusFloorKm(input.geo);

  // Niveau d'extension géographique du prospect (cf. prospect_localisation.
  // geo_extension). Il lève le PLANCHER DE RAYON jusqu'à la portée choisie :
  // un prospect « départemental » accepte les campagnes ville/dept couvrant
  // sa zone (filtre CP) même avec un petit rayon ; « régional » va jusqu'à la
  // région ; « national » lève aussi le filtre CP (accepte partout). Le filtre
  // CP (= « le prospect habite dans la zone ciblée ») reste sinon appliqué.
  const GEO_SCOPE_RANK: Record<string, number> = { ville: 1, dept: 2, region: 3 };
  const EXT_RANK: Record<string, number> = {
    local: 0,
    departemental: 2,
    regional: 3,
    national: 4,
  };
  const campaignScopeRank = GEO_SCOPE_RANK[input.geo] ?? 0;

  // Ciblage « autour de moi » : filtre par distance orthodromique réelle
  // (haversine) entre l'établissement pro et le domicile du prospect, borné
  // par le rayon choisi (10/30/50 km). Sans coordonnées pro → aucun match
  // (la route POST garde déjà ce cas via `pro_address_required`).
  const isAround = input.geo === "around";
  const proPoint: LatLng | null =
    typeof input.proLat === "number" && typeof input.proLng === "number"
      ? { lat: input.proLat, lng: input.proLng }
      : null;
  if (isAround && !proPoint) return [];
  const aroundRadiusM = (input.radiusKm ?? 0) * 1000;

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
      prospect_localisation ( code_postal, targeting_radius_km, national_opt_in, geo_extension, latitude, longitude )
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
    const geoExtension = localisation?.geo_extension ?? "national";
    // `national` lève tous les filtres géo (CP + plancher rayon).
    const nationalOptIn =
      geoExtension === "national" || localisation?.national_opt_in === true;
    // Le plancher de rayon est levé si le prospect est national OU si son
    // niveau d'extension couvre la portée de la campagne (départemental ⊇
    // ville/dept ; régional ⊇ ville/dept/region).
    const bypassRadiusFloor =
      nationalOptIn || (EXT_RANK[geoExtension] ?? 0) >= campaignScopeRank;

    // Filtre CP : un prospect doit habiter dans la zone ciblée. Trois
    // sources possibles (par ordre de priorité) :
    //   1. `geoTarget` ville → match exact sur l'un des CP du commune
    //   2. `geoTarget` dept/region → préfixe(s) sur le code dept
    //   3. legacy `cpPrefixRaw` (dérivé du CP du pro)
    // Dans tous les cas, `national_opt_in=true` bypasse le filtre.
    if (!nationalOptIn && (allowedExactCps || allowedPrefixes || cpPrefixRaw)) {
      const cp = localisation?.code_postal;
      if (!cp) continue;
      let pass = false;
      if (allowedExactCps) {
        pass = allowedExactCps.has(cp);
      } else if (allowedPrefixes) {
        pass = allowedPrefixes.some((p) => cp.startsWith(p));
      } else if (cpPrefixRaw) {
        pass = cp.startsWith(cpPrefixRaw);
      }
      if (!pass) continue;
    }

    // Filtre rayon prospect : le prospect doit avoir réglé son rayon
    // de ciblage >= au plancher imposé par la portée de la campagne.
    // Le flag « national » l'exempte aussi de ce plancher (sémantique
    // « j'accepte n'importe où »). Si la row palier 2 (localisation)
    // n'existe pas, on suppose le default DB (25 km) — cohérent avec
    // le check constraint.
    if (radiusFloorKm != null && !bypassRadiusFloor) {
      const prospectRadius = localisation?.targeting_radius_km ?? 25;
      if (prospectRadius < radiusFloorKm) continue;
    }

    // Filtre « autour de moi » : distance réelle pro↔prospect <= rayon choisi.
    // `national_opt_in=true` exempte (le prospect accepte n'importe où). Le
    // prospect non géocodé est exclu (on ne peut pas mesurer la distance), et
    // sa propre zone d'acceptation (`targeting_radius_km`) doit couvrir la
    // distance — il ne reçoit pas une sollicitation au-delà de ce qu'il a réglé.
    if (isAround && !nationalOptIn) {
      const lat = localisation?.latitude;
      const lng = localisation?.longitude;
      if (typeof lat !== "number" || typeof lng !== "number") continue;
      // proPoint est non-null ici (garde en tête de fonction).
      const distM = haversineMeters(proPoint as LatLng, { lat, lng });
      if (distM > aroundRadiusM) continue;
      const prospectRadiusM = (localisation?.targeting_radius_km ?? 25) * 1000;
      if (prospectRadiusM < distM) continue;
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
