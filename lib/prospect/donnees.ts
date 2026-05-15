/**
 * Couche métier "Mes données" du dashboard prospect.
 *
 * Mapping bijectif entre :
 *   - le modèle UI (camelCase, structure imbriquée par palier)
 *   - les 5 tables Supabase prospect_<tier> (snake_case, prospect_id en PK)
 *
 * Source de vérité de cette structure : `DATA_CATEGORIES` dans
 * `public/prototype/components/Prospect.jsx`. Si un champ y est ajouté,
 * il faut le déclarer ici aussi (sinon il ne sera ni lu ni persisté).
 */

export type TierKey =
  | "identity"
  | "localisation"
  | "vie"
  | "pro"
  | "patrimoine";

export type TierFields = Record<string, string | null>;

export type ProspectDonnees = {
  identity: TierFields;
  localisation: TierFields;
  vie: TierFields;
  pro: TierFields;
  patrimoine: TierFields;
  hiddenTiers: TierKey[];
  removedTiers: TierKey[];
};

type TierMap = {
  table:
    | "prospect_identity"
    | "prospect_localisation"
    | "prospect_vie"
    | "prospect_pro"
    | "prospect_patrimoine";
  /** UI → DB : { camelCase: snake_case }. Quand identique, on met la même clé. */
  fields: Record<string, string>;
};

export const TIERS: Record<TierKey, TierMap> = {
  identity: {
    table: "prospect_identity",
    fields: {
      prenom: "prenom",
      nom: "nom",
      email: "email",
      telephone: "telephone",
      naissance: "naissance",
    },
  },
  localisation: {
    table: "prospect_localisation",
    fields: {
      adresse: "adresse",
      ville: "ville",
      codePostal: "code_postal",
      // Préférence "Zone géographique" (rayon en km autour de la ville
      // déclarée, 5-100 km — slider dans /prospect → Préférences).
      // Stocké côté localisation parce qu'il n'a de sens que conjugué
      // à la ville. Utilisé par lib/campaigns/matching.ts pour filtrer
      // le pool quand un pro lance une campagne.
      targetingRadiusKm: "targeting_radius_km",
      // Opt-in "Étendre au niveau national" — quand true, le matching
      // ignore les filtres CP préfixe + plancher de rayon pour ce
      // prospect. Stocké en boolean, sérialisé en "true"/"false" côté
      // UI par rowToUi (cast string), reconverti par le PATCH route.
      nationalOptIn: "national_opt_in",
    },
  },
  vie: {
    table: "prospect_vie",
    fields: {
      foyer: "foyer",
      sports: "sports",
      animaux: "animaux",
      animauxDetail: "animaux_detail",
      vehicule: "vehicule",
      vehiculeMarque: "vehicule_marque",
      logement: "logement",
      mobilite: "mobilite",
    },
  },
  pro: {
    table: "prospect_pro",
    fields: {
      poste: "poste",
      statut: "statut",
      secteur: "secteur",
      revenus: "revenus",
    },
  },
  patrimoine: {
    table: "prospect_patrimoine",
    fields: {
      residence: "residence",
      epargne: "epargne",
      projets: "projets",
    },
  },
};

export const TIER_KEYS = Object.keys(TIERS) as TierKey[];

export function isTierKey(x: unknown): x is TierKey {
  return typeof x === "string" && (TIER_KEYS as string[]).includes(x);
}

/** Convertit une row Supabase (snake_case) → objet UI (camelCase). */
export function rowToUi(tier: TierKey, row: Record<string, unknown> | null): TierFields {
  const fields = TIERS[tier].fields;
  const out: TierFields = {};
  for (const [ui, db] of Object.entries(fields)) {
    const v = row?.[db];
    out[ui] = typeof v === "string" ? v : v == null ? "" : String(v);
  }
  return out;
}

/** Convertit un patch UI (camelCase) en patch DB (snake_case), en filtrant
 *  les clés inconnues pour le tier — protection contre les attaques de
 *  mass-assignment. Les valeurs scalaires non-string (booleans, numbers)
 *  passent telles quelles dans `out` ; les handlers spécialisés du
 *  route /api/prospect/donnees re-castent/valident avant l'upsert. */
export function uiToRow(tier: TierKey, patch: Record<string, unknown>): Record<string, string | boolean | number | null> {
  const fields = TIERS[tier].fields;
  const out: Record<string, string | boolean | number | null> = {};
  for (const [uiKey, val] of Object.entries(patch)) {
    const dbKey = fields[uiKey];
    if (!dbKey) continue;
    if (val == null) {
      out[dbKey] = null;
    } else if (typeof val === "string") {
      const trimmed = val.trim();
      out[dbKey] = trimmed === "" ? null : trimmed.slice(0, 500);
    } else if (typeof val === "boolean" || typeof val === "number") {
      out[dbKey] = val;
    }
  }
  return out;
}
