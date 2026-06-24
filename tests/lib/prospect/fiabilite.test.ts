import { describe, it, expect } from "vitest";
import {
  fiabilitePctFromRatings,
  fiabiliteAggFromRatings,
  FIABILITE_POINTS,
  FIABILITE_PRIOR_M0,
  FIABILITE_PRIOR_C,
} from "@/lib/prospect/score";

// Moyenne bayésienne : (C·m₀ + Σ points) / (C + n), avec m₀=60, C=3.
describe("fiabilitePctFromRatings (bayésien m₀=60, C=3)", () => {
  it("constants", () => {
    expect(FIABILITE_POINTS).toEqual({ 1: 100, 2: 60, 3: 20 });
    expect(FIABILITE_PRIOR_M0).toBe(60);
    expect(FIABILITE_PRIOR_C).toBe(3);
  });
  it("returns the neutral prior when never rated", () => {
    expect(fiabilitePctFromRatings([])).toBe(60); // (3·60 + 0)/3
  });
  it("a single rating barely moves from the prior", () => {
    expect(fiabilitePctFromRatings([1])).toBe(70); // (180+100)/4
    expect(fiabilitePctFromRatings([2])).toBe(60); // (180+60)/4
    expect(fiabilitePctFromRatings([3])).toBe(50); // (180+20)/4
  });
  it("converges toward the true mean as volume grows", () => {
    // 10× Haute → (180 + 1000)/13 ≈ 90.77 → 91
    expect(fiabilitePctFromRatings(Array(10).fill(1))).toBe(91);
  });
  it("mixed ratings", () => {
    expect(fiabilitePctFromRatings([1, 3])).toBe(60); // (180+120)/5
    expect(fiabilitePctFromRatings([1, 2, 3])).toBe(60); // (180+180)/6
    expect(fiabilitePctFromRatings([3, 3, 3])).toBe(40); // (180+60)/6
    expect(fiabilitePctFromRatings([1, 1, 3])).toBe(67); // (180+220)/6 = 66.7
  });
  it("ignores unknown levels (count only valid ratings)", () => {
    expect(fiabilitePctFromRatings([1, 9, 0])).toBe(70); // only the 1 counts → (180+100)/4
  });
});

// Agrégat cross-pro : nb de pros DISTINCTS par niveau, en retenant la note la
// plus récente de chaque pro (lignes supposées triées par date décroissante).
describe("fiabiliteAggFromRatings (cross-pro, latest per distinct pro)", () => {
  it("zeroed when no ratings", () => {
    expect(fiabiliteAggFromRatings([])).toEqual({ "1": 0, "2": 0, "3": 0 });
  });
  it("counts one per distinct pro and per level", () => {
    expect(
      fiabiliteAggFromRatings([
        { pro_account_id: "a", pro_priority: 1 },
        { pro_account_id: "b", pro_priority: 2 },
        { pro_account_id: "c", pro_priority: 1 },
      ]),
    ).toEqual({ "1": 2, "2": 1, "3": 0 });
  });
  it("keeps only the most recent rating of a repeating pro (first row wins)", () => {
    // Lignes triées desc : la 1re vue pour un pro est sa note la plus récente.
    expect(
      fiabiliteAggFromRatings([
        { pro_account_id: "a", pro_priority: 3 }, // récent → retenu
        { pro_account_id: "a", pro_priority: 1 }, // ancien → ignoré
        { pro_account_id: "b", pro_priority: 2 },
      ]),
    ).toEqual({ "1": 0, "2": 1, "3": 1 });
  });
  it("ignores null pro/level and out-of-range levels", () => {
    expect(
      fiabiliteAggFromRatings([
        { pro_account_id: null, pro_priority: 1 },
        { pro_account_id: "a", pro_priority: null },
        { pro_account_id: "b", pro_priority: 9 },
        { pro_account_id: "c", pro_priority: 2 },
      ]),
    ).toEqual({ "1": 0, "2": 1, "3": 0 });
  });
});
