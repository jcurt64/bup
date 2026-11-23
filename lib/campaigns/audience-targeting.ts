/**
 * Filtres d'audience d'une campagne : villes, sexe, tranche d'âge.
 *
 * Le pro peut restreindre sa campagne à des prospects d'une ou plusieurs
 * villes, d'un sexe et/ou d'une tranche d'âge. Ces données prospect
 * (`prospect_identity.ville / genre / tranche_age`) servent UNIQUEMENT au
 * matching : elles ne sont jamais transmises au pro.
 *
 * Persisté dans `campaigns.targeting` (jsonb) : `cities`, `genres`, `ageBands`.
 * Liste vide = pas de filtre (toute la France / tous / tous âges).
 */

export const PROSPECT_GENRES = ["femme", "homme", "autre"] as const;
export type ProspectGenre = (typeof PROSPECT_GENRES)[number];

/** Sexes ciblables par un pro (« autre » n'est jamais un filtre). */
export const TARGET_GENRES = ["femme", "homme"] as const;
export type TargetGenre = (typeof TARGET_GENRES)[number];

export const AGE_BANDS = ["18-35", "35+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const MAX_TARGET_CITIES = 20;
export const MAX_CITY_LENGTH = 120;

export type AudienceTargeting = {
  cities: string[];
  genres: TargetGenre[];
  ageBands: AgeBand[];
};

export const EMPTY_AUDIENCE: AudienceTargeting = { cities: [], genres: [], ageBands: [] };

export function isProspectGenre(v: unknown): v is ProspectGenre {
  return typeof v === "string" && (PROSPECT_GENRES as readonly string[]).includes(v);
}

export function isAgeBand(v: unknown): v is AgeBand {
  return typeof v === "string" && (AGE_BANDS as readonly string[]).includes(v);
}

/**
 * Clé de comparaison d'une ville : insensible à la casse, aux accents, aux
 * tirets / apostrophes / espaces multiples. "Saint-Étienne" == "saint etienne".
 */
export function normalizeCityKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Nettoyage d'un nom de ville saisi (espaces normalisés, longueur bornée). */
export function cleanCityName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/\s+/g, " ").trim().slice(0, MAX_CITY_LENGTH).trim();
  return v === "" ? null : v;
}

/**
 * Motif `ilike` (pré-filtre SQL) pour une ville : chaque caractère qui peut
 * varier (voyelle accentuée, c/ç, n/ñ, y/ÿ, séparateur) devient `_` ; les
 * autres lettres ASCII et chiffres sont conservés. Ne contient que [a-z0-9_]
 * → sûr dans un filtre PostgREST `or(...)`. L'égalité exacte est ensuite
 * revérifiée en JS avec `normalizeCityKey`.
 */
export function cityIlikePattern(city: string): string {
  const key = normalizeCityKey(city);
  let out = "";
  for (const ch of key) {
    out += /[bdfghjklmpqrstvwxz0-9]/.test(ch) ? ch : "_";
  }
  return out;
}

export type ParseAudienceResult =
  | { ok: true; value: AudienceTargeting }
  | { ok: false; error: "invalid_target_cities" | "invalid_target_genres" | "invalid_target_age_bands" };

/** Valide les filtres d'audience d'un body client (champs absents = vides). */
export function parseAudienceTargeting(body: {
  targetCities?: unknown;
  targetGenres?: unknown;
  targetAgeBands?: unknown;
}): ParseAudienceResult {
  const cities: string[] = [];
  if (body.targetCities != null) {
    if (!Array.isArray(body.targetCities)) return { ok: false, error: "invalid_target_cities" };
    const seen = new Set<string>();
    for (const raw of body.targetCities) {
      if (typeof raw !== "string") return { ok: false, error: "invalid_target_cities" };
      const name = cleanCityName(raw);
      if (!name) continue;
      const key = normalizeCityKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      cities.push(name);
    }
    if (cities.length > MAX_TARGET_CITIES) return { ok: false, error: "invalid_target_cities" };
  }

  let genres: TargetGenre[] = [];
  if (body.targetGenres != null) {
    if (!Array.isArray(body.targetGenres)) return { ok: false, error: "invalid_target_genres" };
    const set = new Set<string>();
    for (const g of body.targetGenres) {
      if (typeof g !== "string" || !(TARGET_GENRES as readonly string[]).includes(g)) {
        return { ok: false, error: "invalid_target_genres" };
      }
      set.add(g);
    }
    genres = TARGET_GENRES.filter((g) => set.has(g));
  }

  let ageBands: AgeBand[] = [];
  if (body.targetAgeBands != null) {
    if (!Array.isArray(body.targetAgeBands)) return { ok: false, error: "invalid_target_age_bands" };
    const set = new Set<string>();
    for (const a of body.targetAgeBands) {
      if (!isAgeBand(a)) return { ok: false, error: "invalid_target_age_bands" };
      set.add(a);
    }
    ageBands = AGE_BANDS.filter((a) => set.has(a));
  }

  return { ok: true, value: { cities, genres, ageBands } };
}

/** Lecture défensive depuis `campaigns.targeting` (valeurs inconnues ignorées). */
export function readAudienceTargeting(targeting: unknown): AudienceTargeting {
  const t = (targeting && typeof targeting === "object" ? targeting : {}) as Record<string, unknown>;
  const cities = Array.isArray(t.cities)
    ? (t.cities.map(cleanCityName).filter(Boolean) as string[]).slice(0, MAX_TARGET_CITIES)
    : [];
  const genres = Array.isArray(t.genres)
    ? TARGET_GENRES.filter((g) => (t.genres as unknown[]).includes(g))
    : [];
  const ageBands = Array.isArray(t.ageBands)
    ? AGE_BANDS.filter((a) => (t.ageBands as unknown[]).includes(a))
    : [];
  return { cities, genres, ageBands };
}

/** Un prospect (ville / genre / tranche) passe-t-il les filtres d'audience ?
 *  Un champ manquant exclut le prospect d'une campagne filtrée sur ce champ. */
export function identityMatchesAudience(
  identity: { ville?: string | null; genre?: string | null; tranche_age?: string | null } | null | undefined,
  audience: AudienceTargeting,
): boolean {
  if (audience.cities.length > 0) {
    const key = normalizeCityKey(identity?.ville);
    if (!key) return false;
    if (!audience.cities.some((c) => normalizeCityKey(c) === key)) return false;
  }
  if (audience.genres.length > 0) {
    const g = identity?.genre;
    if (!g || !(audience.genres as string[]).includes(g)) return false;
  }
  if (audience.ageBands.length > 0) {
    const a = identity?.tranche_age;
    if (!a || !(audience.ageBands as string[]).includes(a)) return false;
  }
  return true;
}

/* ─────────────── Édition en cours : élargir seulement ─────────────── */

/**
 * Une liste-filtre élargit (ou garde) la cible si : elle devient vide (plus de
 * filtre), ou elle contient tous les éléments actuels (ajouts seulement)
 * alors que la liste actuelle filtrait déjà. Passer de « pas de filtre » à un
 * filtre = restreindre ✗.
 */
function listWidens(current: string[], next: string[], key: (s: string) => string): boolean {
  if (next.length === 0) return true;
  if (current.length === 0) return false;
  const nextKeys = new Set(next.map(key));
  return current.every((c) => nextKeys.has(key(c)));
}

export type AudienceWidenResult =
  | { ok: true; value: AudienceTargeting }
  | {
      ok: false;
      error:
        | "invalid_target_cities"
        | "invalid_target_genres"
        | "invalid_target_age_bands"
        | "target_cities_not_widening"
        | "target_genres_not_widening"
        | "target_age_bands_not_widening";
    };

/**
 * Valide l'édition des filtres d'audience d'une campagne en cours. Seuls les
 * champs présents dans `body` sont modifiés ; chacun doit élargir la cible.
 */
export function classifyAudienceWiden(
  current: AudienceTargeting,
  body: { targetCities?: unknown; targetGenres?: unknown; targetAgeBands?: unknown },
): AudienceWidenResult {
  const parsed = parseAudienceTargeting(body);
  if (!parsed.ok) return parsed;
  const next: AudienceTargeting = { ...current };
  if (body.targetCities !== undefined) {
    if (!listWidens(current.cities, parsed.value.cities, normalizeCityKey)) {
      return { ok: false, error: "target_cities_not_widening" };
    }
    next.cities = parsed.value.cities;
  }
  if (body.targetGenres !== undefined) {
    if (!listWidens(current.genres, parsed.value.genres, (s) => s)) {
      return { ok: false, error: "target_genres_not_widening" };
    }
    next.genres = parsed.value.genres;
  }
  if (body.targetAgeBands !== undefined) {
    if (!listWidens(current.ageBands, parsed.value.ageBands, (s) => s)) {
      return { ok: false, error: "target_age_bands_not_widening" };
    }
    next.ageBands = parsed.value.ageBands;
  }
  return { ok: true, value: next };
}
