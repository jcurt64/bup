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

  it("ignores legacy categorical filters (données supprimées)", () => {
    expect(matchesFilters(c({}), sanitizeFilters({ region: ["Rhône"] }))).toBe(true);
  });

  it("free-text q is case/accent-insensitive over prénom/initiale", () => {
    const ct = c({ identity: { prenom: "Hélène", nom: "D" } });
    expect(matchesFilters(ct, { q: "helene" })).toBe(true);
    expect(matchesFilters(ct, { q: "avocat" })).toBe(false);
    expect(matchesFilters(c({}), { q: "helene" })).toBe(false);
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
    expect((f as Record<string, unknown>).region).toBeUndefined();
    expect((f as Record<string, unknown>).evil).toBeUndefined();
  });

  it("returns {} on non-object input", () => {
    expect(sanitizeFilters(null)).toEqual({});
    expect(sanitizeFilters("nope")).toEqual({});
  });
});
