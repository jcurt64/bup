import { describe, it, expect } from "vitest";
import {
  cityIlikePattern,
  classifyAudienceWiden,
  identityMatchesAudience,
  normalizeCityKey,
  parseAudienceTargeting,
  readAudienceTargeting,
} from "@/lib/campaigns/audience-targeting";

describe("normalizeCityKey", () => {
  it("ignore casse, accents, tirets et apostrophes", () => {
    expect(normalizeCityKey("Saint-Étienne")).toBe(normalizeCityKey("saint etienne"));
    expect(normalizeCityKey("L'Haÿ-les-Roses")).toBe(normalizeCityKey("l hay les roses"));
    expect(normalizeCityKey("  PARIS ")).toBe("paris");
  });
});

describe("cityIlikePattern", () => {
  it("ne contient que [a-z0-9_] et couvre les variantes", () => {
    const p = cityIlikePattern("Saint-Étienne");
    expect(p).toMatch(/^[a-z0-9_]+$/);
    // Le motif doit matcher les deux orthographes (comparaison ilike simulée).
    const re = new RegExp(`^${p.replace(/_/g, ".")}$`, "i");
    expect(re.test("Saint-Étienne")).toBe(true);
    expect(re.test("saint etienne")).toBe(true);
  });
});

describe("parseAudienceTargeting", () => {
  it("absents → aucun filtre", () => {
    expect(parseAudienceTargeting({})).toEqual({
      ok: true,
      value: { cities: [], genres: [], ageBands: [] },
    });
  });

  it("dédoublonne les villes (normalisées) et ordonne genres / tranches", () => {
    const r = parseAudienceTargeting({
      targetCities: [" Lyon ", "lyon", "Saint-Étienne", "saint etienne", ""],
      targetGenres: ["homme", "femme", "homme"],
      targetAgeBands: ["35+", "18-35"],
    });
    expect(r).toEqual({
      ok: true,
      value: {
        cities: ["Lyon", "Saint-Étienne"],
        genres: ["femme", "homme"],
        ageBands: ["18-35", "35+"],
      },
    });
  });

  it("refuse les valeurs invalides", () => {
    expect(parseAudienceTargeting({ targetCities: "Lyon" }).ok).toBe(false);
    expect(
      parseAudienceTargeting({ targetCities: Array.from({ length: 21 }, (_, i) => `Ville${i}`) }),
    ).toEqual({ ok: false, error: "invalid_target_cities" });
    expect(parseAudienceTargeting({ targetGenres: ["autre"] })).toEqual({
      ok: false,
      error: "invalid_target_genres",
    });
    expect(parseAudienceTargeting({ targetAgeBands: ["50+"] })).toEqual({
      ok: false,
      error: "invalid_target_age_bands",
    });
  });
});

describe("identityMatchesAudience", () => {
  const base = { ville: "Saint-Étienne", genre: "femme", tranche_age: "18-35" };

  it("sans filtre, tout le monde passe (même sans données)", () => {
    expect(identityMatchesAudience({}, { cities: [], genres: [], ageBands: [] })).toBe(true);
  });

  it("ville : égalité normalisée", () => {
    const a = { cities: ["saint etienne"], genres: [], ageBands: [] };
    expect(identityMatchesAudience(base, a)).toBe(true);
    expect(identityMatchesAudience({ ...base, ville: "Lyon" }, a)).toBe(false);
    expect(identityMatchesAudience({ ...base, ville: null }, a)).toBe(false);
  });

  it("genre : 'autre' / null exclus dès qu'un filtre sexe existe", () => {
    const a = { cities: [], genres: ["femme" as const, "homme" as const], ageBands: [] };
    expect(identityMatchesAudience(base, a)).toBe(true);
    expect(identityMatchesAudience({ ...base, genre: "autre" }, a)).toBe(false);
    expect(identityMatchesAudience({ ...base, genre: null }, a)).toBe(false);
    expect(
      identityMatchesAudience({ ...base, genre: "autre" }, { cities: [], genres: [], ageBands: [] }),
    ).toBe(true);
  });

  it("tranche d'âge", () => {
    const a = { cities: [], genres: [], ageBands: ["35+" as const] };
    expect(identityMatchesAudience(base, a)).toBe(false);
    expect(identityMatchesAudience({ ...base, tranche_age: "35+" }, a)).toBe(true);
    expect(identityMatchesAudience({ ...base, tranche_age: null }, a)).toBe(false);
  });
});

describe("readAudienceTargeting", () => {
  it("lecture défensive", () => {
    expect(readAudienceTargeting(null)).toEqual({ cities: [], genres: [], ageBands: [] });
    expect(
      readAudienceTargeting({ cities: ["Lyon", 3], genres: ["autre", "homme"], ageBands: ["x"] }),
    ).toEqual({ cities: ["Lyon"], genres: ["homme"], ageBands: [] });
  });
});

describe("classifyAudienceWiden (édition en cours)", () => {
  const cur = { cities: ["Lyon"], genres: ["femme" as const], ageBands: ["18-35" as const] };

  it("retirer un filtre ou ajouter des valeurs = élargir", () => {
    expect(classifyAudienceWiden(cur, { targetCities: [] })).toEqual({
      ok: true,
      value: { ...cur, cities: [] },
    });
    expect(classifyAudienceWiden(cur, { targetCities: ["lyon", "Paris"] })).toEqual({
      ok: true,
      value: { ...cur, cities: ["lyon", "Paris"] },
    });
    expect(classifyAudienceWiden(cur, { targetGenres: ["femme", "homme"] }).ok).toBe(true);
    expect(classifyAudienceWiden(cur, { targetAgeBands: [] }).ok).toBe(true);
  });

  it("restreindre = refusé", () => {
    expect(classifyAudienceWiden(cur, { targetCities: ["Paris"] })).toEqual({
      ok: false,
      error: "target_cities_not_widening",
    });
    expect(classifyAudienceWiden(cur, { targetGenres: ["homme"] })).toEqual({
      ok: false,
      error: "target_genres_not_widening",
    });
    const open = { cities: [], genres: [], ageBands: [] };
    expect(classifyAudienceWiden(open, { targetAgeBands: ["35+"] })).toEqual({
      ok: false,
      error: "target_age_bands_not_widening",
    });
  });

  it("valeur invalide = erreur de validation", () => {
    expect(classifyAudienceWiden(cur, { targetGenres: ["x"] })).toEqual({
      ok: false,
      error: "invalid_target_genres",
    });
  });
});
