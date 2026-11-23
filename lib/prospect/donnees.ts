/**
 * Couche métier "Mes données" du prospect.
 *
 * Pivot « mise en relation pure » (nov. 2026) : les SEULES données
 * personnelles collectées sont le prénom, l'INITIALE du nom, la ville (nom de
 * la commune seul, sans code postal ni adresse), le sexe, la tranche d'âge
 * (18-35 / 35+), le téléphone et l'e-mail (table `prospect_identity`).
 * Ville / sexe / tranche d'âge servent uniquement au ciblage des campagnes
 * (matching) et ne sont jamais transmis aux professionnels. Les 4 autres paliers historiques
 * (localisation, vie, pro, patrimoine) et la date de naissance ont été
 * supprimés.
 *
 * Les clés de paliers historiques restent reconnues pour la compatibilité des
 * applications mobiles déjà publiées : toute écriture les visant est un no-op.
 */

import { nomInitial } from "@/lib/campaigns/contact-channels";
import {
  isAgeBand,
  isProspectGenre,
  type AgeBand,
  type ProspectGenre,
} from "@/lib/campaigns/audience-targeting";

/** Clés de paliers historiques (acceptées en entrée, ignorées sauf identity). */
export type TierKey =
  | "identity"
  | "localisation"
  | "vie"
  | "pro"
  | "patrimoine";

export const LEGACY_TIER_KEYS: TierKey[] = [
  "identity",
  "localisation",
  "vie",
  "pro",
  "patrimoine",
];

/** Compat : anciens imports `TIER_KEYS`. */
export const TIER_KEYS = LEGACY_TIER_KEYS;

export function isTierKey(x: unknown): x is TierKey {
  return typeof x === "string" && (LEGACY_TIER_KEYS as string[]).includes(x);
}

export type TierFields = Record<string, string | null>;

/** Champs du profil prospect (noms UI). `trancheAge` ↔ colonne `tranche_age`,
 *  les autres ont le même nom en DB. */
export const IDENTITY_FIELDS = [
  "prenom",
  "nom",
  "ville",
  "genre",
  "trancheAge",
  "email",
  "telephone",
] as const;

/** Longueur max de la ville stockée (nom de commune seul). */
export const VILLE_MAX_LENGTH = 120;
export type IdentityField = (typeof IDENTITY_FIELDS)[number];

export type IdentityUi = Record<IdentityField, string>;

/** Shape GET /api/prospect/donnees (rétro-compatible mobile publié). */
export type ProspectDonnees = {
  identity: IdentityUi;
  localisation: Record<string, never>;
  vie: Record<string, never>;
  pro: Record<string, never>;
  patrimoine: Record<string, never>;
  hiddenTiers: TierKey[];
  removedTiers: TierKey[];
};

/** Row prospect_identity → objet UI. `nom` est toujours renvoyé en initiale ;
 *  `genre` / `trancheAge` = "" si absents ou hors valeurs connues. */
export function identityRowToUi(row: Record<string, unknown> | null | undefined): IdentityUi {
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  return {
    prenom: str(row?.prenom),
    nom: nomInitial(row?.nom) ?? "",
    ville: str(row?.ville),
    genre: isProspectGenre(row?.genre) ? row.genre : "",
    trancheAge: isAgeBand(row?.tranche_age) ? row.tranche_age : "",
    email: str(row?.email),
    telephone: str(row?.telephone),
  };
}

/** Colonnes `prospect_identity` modifiables via PATCH /api/prospect/donnees. */
export type IdentityRowPatch = Partial<{
  prenom: string | null;
  nom: string | null;
  ville: string | null;
  genre: ProspectGenre | null;
  tranche_age: AgeBand | null;
  email: string | null;
  telephone: string | null;
}>;

export type IdentityPatchResult =
  | { ok: true; row: IdentityRowPatch }
  | { ok: false; error: "invalid_genre" | "invalid_tranche_age" };

/**
 * Patch UI → patch DB pour `prospect_identity`, en ne gardant QUE les 7
 * champs autorisés (anti mass-assignment). Règles :
 *   - `nom` normalisé en son initiale majuscule ("élodie" → "É") ;
 *   - `ville` = nom de commune seul, espaces normalisés, ≤ VILLE_MAX_LENGTH ;
 *   - `genre` ∈ femme | homme | autre, `trancheAge` ∈ 18-35 | 35+ (sinon
 *     erreur) ; `trancheAge` → colonne `tranche_age` ;
 *   - chaîne vide / null → null ; valeur non-chaîne ignorée (texte) ou
 *     refusée (genre / tranche).
 */
export function parseIdentityPatch(patch: Record<string, unknown>): IdentityPatchResult {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(patch, k);
  const row: IdentityRowPatch = {};

  for (const key of ["prenom", "email", "telephone"] as const) {
    if (!has(key)) continue;
    const val = patch[key];
    if (val == null) row[key] = null;
    else if (typeof val === "string") {
      const t = val.trim();
      row[key] = t === "" ? null : t.slice(0, 500);
    }
  }

  if (has("nom")) {
    const val = patch.nom;
    if (val == null) row.nom = null;
    else if (typeof val === "string") row.nom = nomInitial(val);
  }

  if (has("ville")) {
    const val = patch.ville;
    if (val == null) row.ville = null;
    else if (typeof val === "string") {
      const v = val.replace(/\s+/g, " ").trim();
      row.ville = v === "" ? null : v.slice(0, VILLE_MAX_LENGTH).trim();
    }
  }

  if (has("genre")) {
    const val = patch.genre;
    if (val == null || val === "") row.genre = null;
    else if (isProspectGenre(val)) row.genre = val;
    else return { ok: false, error: "invalid_genre" };
  }

  const ageKey = has("trancheAge") ? "trancheAge" : has("tranche_age") ? "tranche_age" : null;
  if (ageKey) {
    const val = patch[ageKey];
    if (val == null || val === "") row.tranche_age = null;
    else if (isAgeBand(val)) row.tranche_age = val;
    else return { ok: false, error: "invalid_tranche_age" };
  }

  return { ok: true, row };
}
