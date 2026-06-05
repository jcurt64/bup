import { describe, expect, it } from "vitest";
import { applyScoreMalus } from "@/lib/prospect/score";

describe("applyScoreMalus", () => {
  it("soustrait le malus", () => {
    expect(applyScoreMalus(800, 100)).toBe(700);
  });
  it("plancher à 0 (jamais négatif)", () => {
    expect(applyScoreMalus(50, 100)).toBe(0);
    expect(applyScoreMalus(0, 100)).toBe(0);
  });
  it("malus nul = score inchangé", () => {
    expect(applyScoreMalus(640, 0)).toBe(640);
  });
  it("ignore un malus négatif (ne bonifie pas)", () => {
    expect(applyScoreMalus(640, -100)).toBe(640);
  });
});
