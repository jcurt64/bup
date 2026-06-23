import { describe, it, expect } from "vitest";
import { remainingSolicitationSlots } from "@/lib/campaigns/resolicit";

describe("remainingSolicitationSlots", () => {
  it("returns the unfilled paid slots", () => {
    expect(remainingSolicitationSlots(50, 30)).toBe(20);
  });
  it("is zero when the quota is already fully solicited", () => {
    expect(remainingSolicitationSlots(50, 50)).toBe(0);
  });
  it("never goes negative (over-solicited / quota lowered)", () => {
    expect(remainingSolicitationSlots(50, 60)).toBe(0);
  });
  it("floors fractional inputs", () => {
    expect(remainingSolicitationSlots(50.9, 30.2)).toBe(20);
  });
});
