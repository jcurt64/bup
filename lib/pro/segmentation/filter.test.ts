import { describe, it, expect } from "vitest";
import { matchesFilters, sanitizeFilters } from "./filter";
import type { SegmentContact } from "./types";

function c(over: Partial<SegmentContact>): SegmentContact {
  return { relationId: "r", score: 700, reached: null, ...over };
}

describe("matchesFilters", () => {
  it("filters by score range (inclusive)", () => {
    expect(matchesFilters(c({ score: 720 }), { scoreMin: 720 })).toBe(true);
    expect(matchesFilters(c({ score: 719 }), { scoreMin: 720 })).toBe(false);
    expect(matchesFilters(c({ score: 800 }), { scoreMax: 750 })).toBe(false);
  });

  it("filters by reached", () => {
    expect(matchesFilters(c({ reached: "atteint" }), { reached: "atteint" })).toBe(true);
    expect(matchesFilters(c({ reached: null }), { reached: "atteint" })).toBe(false);
  });

  it("filters by categorical multiselect; null value never matches", () => {
    const withRegion = c({ localisation: { region: "Rhône", ville: null, codePostal: null, adresse: null, centerDistanceM: null } });
    expect(matchesFilters(withRegion, { region: ["Rhône", "Paris"] })).toBe(true);
    expect(matchesFilters(withRegion, { region: ["Paris"] })).toBe(false);
    expect(matchesFilters(c({}), { region: ["Rhône"] })).toBe(false);
  });

  it("filters by distance band (dérivée de center_distance_m)", () => {
    const near = c({ localisation: { region: null, ville: null, codePostal: null, adresse: null, centerDistanceM: 800 } });
    const far = c({ localisation: { region: null, ville: null, codePostal: null, adresse: null, centerDistanceM: 7000 } });
    expect(matchesFilters(near, { distance: ["< 2 km du centre"] })).toBe(true);
    expect(matchesFilters(near, { distance: ["5–10 km du centre"] })).toBe(false);
    expect(matchesFilters(far, { distance: ["5–10 km du centre"] })).toBe(true);
    // distance absente → ne matche jamais un filtre distance actif
    expect(matchesFilters(c({}), { distance: ["< 2 km du centre"] })).toBe(false);
  });

  it("ANDs all criteria", () => {
    const ct = c({ score: 730, localisation: { region: "Rhône", ville: null, codePostal: null, adresse: null, centerDistanceM: null } });
    expect(matchesFilters(ct, { scoreMin: 720, region: ["Rhône"] })).toBe(true);
    expect(matchesFilters(ct, { scoreMin: 740, region: ["Rhône"] })).toBe(false);
  });

  it("free-text q is case/accent-insensitive over allowed soft fields only", () => {
    const ct = c({ pro: { poste: "Médecin", statut: null, secteur: null, revenus: null } });
    expect(matchesFilters(ct, { q: "medecin" })).toBe(true);
    expect(matchesFilters(ct, { q: "avocat" })).toBe(false);
    expect(matchesFilters(c({}), { q: "medecin" })).toBe(false);
  });
});

describe("sanitizeFilters", () => {
  it("keeps known fields, drops unknown, bounds arrays and q", () => {
    const f = sanitizeFilters({
      scoreMin: 600, scoreMax: "x", reached: "atteint", q: "  Lyon  ",
      region: ["Rhône", 42, "Paris"], evil: ["x"],
    });
    expect(f.scoreMin).toBe(600);
    expect(f.scoreMax).toBeUndefined();
    expect(f.reached).toBe("atteint");
    expect(f.q).toBe("Lyon");
    expect(f.region).toEqual(["Rhône", "Paris"]);
    expect((f as Record<string, unknown>).evil).toBeUndefined();
  });

  it("returns {} on non-object input", () => {
    expect(sanitizeFilters(null)).toEqual({});
    expect(sanitizeFilters("nope")).toEqual({});
  });
});
