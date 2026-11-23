import { describe, it, expect } from "vitest";
import { buildFacets } from "./facets";
import type { SegmentContact } from "./types";

function c(over: Partial<SegmentContact>): SegmentContact {
  return { relationId: Math.random().toString(), score: 700, reached: null, ...over };
}

describe("buildFacets", () => {
  it("buckets scores into <600 / 600-719 / ≥720", () => {
    const f = buildFacets(
      [c({ score: 500 }), c({ score: 650 }), c({ score: 720 }), c({ score: 800 })],
      [],
    );
    expect(f.total).toBe(4);
    expect(f.score).toEqual([
      { label: "< 600", count: 1 },
      { label: "600 – 719", count: 1 },
      { label: "≥ 720", count: 2 },
    ]);
  });

  it("counts reached status including 'Non évalué'", () => {
    const f = buildFacets([c({ reached: "atteint" }), c({ reached: "non_atteint" }), c({ reached: null })], []);
    expect(f.reached).toEqual(
      expect.arrayContaining([
        { value: "Atteint", count: 1 },
        { value: "Non atteint", count: 1 },
        { value: "Non évalué", count: 1 },
      ]),
    );
  });

  it("no longer builds categorical facets (legacy tier data deleted)", () => {
    const f = buildFacets([c({})], ["identity"]);
    expect(f.region).toBeUndefined();
    expect(f.distance).toBeUndefined();
    expect(f.statutPro).toBeUndefined();
  });
});
