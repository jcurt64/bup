import { describe, it, expect } from "vitest";
import { FREEBUUPP_FEE_CENTS, shouldRefund } from "@/lib/freebuupp/pricing";

describe("freebuupp/pricing", () => {
  it("le tarif est 10 € fixe", () => {
    expect(FREEBUUPP_FEE_CENTS).toBe(1000);
  });
  it("rembourse si et seulement si 0 inscrit", () => {
    expect(shouldRefund(0)).toBe(true);
    expect(shouldRefund(1)).toBe(false);
    expect(shouldRefund(30)).toBe(false);
  });
});
