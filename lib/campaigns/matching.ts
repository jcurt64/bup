/**
 * Sélection des prospects qui matchent les critères d'une campagne.
 *
 * Appelé exclusivement en service_role (POST /api/pro/campaigns,
 * re-sollicitation) — la requête lit en cross-prospect.
 *
 * Pivot « mise en relation pure » : plus de paliers de données. Un prospect
 * est éligible s'il a renseigné son prénom + l'initiale de son nom ET la/les
 * coordonnée(s) requise(s) par les canaux de contact de la campagne
 * (téléphone et/ou e-mail).
 *
 * Filtres d'audience optionnels (cf. audience-targeting.ts) : villes (égalité
 * insensible casse/accents/tirets sur prospect_identity.ville), sexe
 * (femme/homme) et tranche d'âge (18-35 / 35+). Liste vide = pas de filtre ;
 * un prospect sans la donnée filtrée est exclu de cette campagne. Ces données
 * ne sortent jamais du matching (jamais renvoyées au pro).
 *
 * Restent appliqués : niveau de vérification, exclusion des certifiés,
 * fiabilité minimum, type de campagne accepté, exclusions explicites.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  acceptableVerifLevels,
  objectiveToCampaignType,
  type CampaignTypeDb,
} from "./mapping";
import {
  DEFAULT_CONTACT_CHANNELS,
  identityCoversChannels,
  type ContactChannel,
} from "./contact-channels";
import {
  EMPTY_AUDIENCE,
  cityIlikePattern,
  identityMatchesAudience,
  type AudienceTargeting,
} from "./audience-targeting";
import { pgTextArrayLiteral } from "./domains";

export type MatchingInput = {
  objectiveId: string;
  /** Canaux de contact de la campagne (défaut : téléphone + e-mail). */
  contactChannels?: ContactChannel[];
  verifLevel: string;
  contacts: number;
  /** Quand true, retire les prospects `certifie_confiance` du pool. */
  excludeCertified?: boolean;
  /** Prospects à NE PAS resélectionner (déjà sollicités, anciens acceptants). */
  excludeProspectIds?: string[];
  /** Fiabilité minimum (0-100). Quand > 0, ne retient que les prospects dont
   *  `prospects.fiabilite_pct >= seuil` (NULL exclus). */
  minFiabilitePct?: number | null;
  /** Filtres d'audience (villes / sexe / tranche d'âge). Absent = aucun. */
  audience?: AudienceTargeting;
  /** Domaines d'activité de la campagne (≤ 2). Vide/absent = « Tous ». */
  domains?: string[];
  /** Pro de TEST (`pro_accounts.is_test`) : true → seuls les prospects de
   *  test sont éligibles ; false/absent → les prospects de test sont exclus.
   *  Cf. lib/test-accounts. */
  testAccounts?: boolean;
  // ── Champs historiques (ciblage géo/âge/paliers) : acceptés mais IGNORÉS.
  requiredTiers?: number[];
  geo?: string;
  geoTarget?: unknown;
  proCodePostal?: string | null;
  proLat?: number | null;
  proLng?: number | null;
  radiusKm?: number | null;
  ages?: string[];
};

export type MatchedProspect = {
  prospectId: string;
  email: string | null;
  prenom: string | null;
  /** Niveau de vérification au moment du match (bonus ×2 certifié). */
  verification: "basique" | "verifie" | "certifie_confiance";
};

/** Taille max de la liste d'exclusion passée en filtre PostgREST `not.in`. */
const MAX_SQL_EXCLUDE_IDS = 300;

/** Sur-échantillonnage : la complétude des coordonnées est revérifiée en JS
 *  (chaînes vides), on ramène un peu plus de lignes que demandé. */
const OVERSAMPLE_FACTOR = 2;

export async function findMatchingProspects(
  admin: SupabaseClient<Database>,
  input: MatchingInput,
): Promise<MatchedProspect[]> {
  const channels =
    input.contactChannels && input.contactChannels.length > 0
      ? input.contactChannels
      : DEFAULT_CONTACT_CHANNELS;
  let acceptableLevels = acceptableVerifLevels(input.verifLevel);
  if (input.excludeCertified) {
    acceptableLevels = acceptableLevels.filter(
      (l) => l !== "certifie_confiance",
    );
  }
  const excludeSet = new Set(input.excludeProspectIds ?? []);
  const campaignType: CampaignTypeDb = objectiveToCampaignType(input.objectiveId);

  const sqlExclude = excludeSet.size > 0 && excludeSet.size <= MAX_SQL_EXCLUDE_IDS;
  const audience = input.audience ?? EMPTY_AUDIENCE;
  // Le pré-filtre ville (ilike) est plus large que l'égalité normalisée →
  // sur-échantillonnage renforcé quand un filtre ville est actif.
  const oversample =
    audience.cities.length > 0 ? OVERSAMPLE_FACTOR * 3 : OVERSAMPLE_FACTOR;
  const selectLimit =
    input.contacts * oversample + (sqlExclude ? 0 : excludeSet.size);

  // `!inner` : seuls les prospects ayant une ligne prospect_identity
  // remontent, et les filtres sur l'embed filtrent bien le parent.
  let query = admin
    .from("prospects")
    .select(
      `
      id,
      verification,
      prospect_identity!inner ( email, prenom, nom, telephone, ville, genre, tranche_age )
    `,
    )
    .in("verification", acceptableLevels)
    // Cloisonnement comptes de test ↔ vrais comptes (cf. lib/test-accounts).
    .eq("is_test", input.testAccounts === true)
    .not("prospect_identity.prenom", "is", null)
    .not("prospect_identity.nom", "is", null);
  if (channels.includes("phone")) {
    query = query.not("prospect_identity.telephone", "is", null);
  }
  if (channels.includes("email")) {
    query = query.not("prospect_identity.email", "is", null);
  }

  // ── Filtres d'audience ───────────────────────────────────────────
  if (audience.genres.length > 0) {
    query = query.in("prospect_identity.genre", audience.genres);
  }
  if (audience.ageBands.length > 0) {
    query = query.in("prospect_identity.tranche_age", audience.ageBands);
  }
  if (audience.cities.length > 0) {
    // Pré-filtre SQL large (motifs ilike `_` sur les caractères variables),
    // l'égalité normalisée exacte est revérifiée en JS ci-dessous.
    const patterns = [...new Set(audience.cities.map(cityIlikePattern))].filter(Boolean);
    if (patterns.length === 0) return [];
    query = query.or(
      patterns.map((p) => `ville.ilike.${p}`).join(","),
      { referencedTable: "prospect_identity" },
    );
  }

  if (sqlExclude) {
    query = query.not("id", "in", `(${[...excludeSet].join(",")})`);
  }

  const minFiab = Number(input.minFiabilitePct ?? 0);
  if (minFiab > 0) {
    query = query.gte("fiabilite_pct", minFiab);
  }

  // Filtre type campagne : `all_campaign_types=true OR enum dans campaign_types`.
  // ⚠ campaignType DOIT venir de `objectiveToCampaignType` (enum literal).
  // Domaines d'activité : prospect « Tous » OU au moins un domaine commun.
  // Un seul `or` (forme développée) pour combiner proprement les deux
  // conditions (type ET domaine) — cf. lib/campaigns/domains.ts.
  const typeConds = ["all_campaign_types.eq.true", `campaign_types.cs.{${campaignType}}`];
  const domains = input.domains ?? [];
  if (domains.length > 0) {
    const domainConds = ["all_categories.eq.true", `categories.ov.${pgTextArrayLiteral(domains)}`];
    query = query.or(
      typeConds.flatMap((t) => domainConds.map((d) => `and(${t},${d})`)).join(","),
    );
  } else {
    query = query.or(typeConds.join(","));
  }

  const { data, error } = await query
    .order("bupp_score", { ascending: false })
    .order("id", { ascending: true })
    .limit(selectLimit);
  if (error) throw error;
  if (!data) return [];

  const matched: MatchedProspect[] = [];
  for (const row of data) {
    if (matched.length >= input.contacts) break;
    if (excludeSet.has(row.id)) continue;
    const identity = row.prospect_identity;
    if (!identityCoversChannels(identity, channels)) continue;
    if (!identityMatchesAudience(identity, audience)) continue;
    matched.push({
      prospectId: row.id,
      email: identity?.email ?? null,
      prenom: identity?.prenom ?? null,
      verification: row.verification as MatchedProspect["verification"],
    });
  }
  return matched;
}
