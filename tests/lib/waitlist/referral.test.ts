import { describe, expect, it } from "vitest";
import { referralBadgeTier } from "@/lib/waitlist/referral";

describe("referralBadgeTier", () => {
  it("renvoie null à 0 filleul", () => {
    expect(referralBadgeTier(0)).toBeNull();
  });
  it("renvoie cuivre pour 1-2 filleuls", () => {
    expect(referralBadgeTier(1)).toBe("cuivre");
    expect(referralBadgeTier(2)).toBe("cuivre");
  });
  it("renvoie argent pour 3-9 filleuls", () => {
    expect(referralBadgeTier(3)).toBe("argent");
    expect(referralBadgeTier(9)).toBe("argent");
  });
  it("renvoie or à partir de 10 filleuls", () => {
    expect(referralBadgeTier(10)).toBe("or");
    expect(referralBadgeTier(11)).toBe("or");
  });
});
