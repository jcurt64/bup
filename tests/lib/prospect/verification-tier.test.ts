import { describe, expect, it } from "vitest";
import { tierFromSignals } from "@/lib/prospect/verification-tier";

const base = { phoneVerified: false, proValidations: 0, approvedStudies: 0 };

describe("tierFromSignals — certifié confiance = validation par un pro", () => {
  it("basique par défaut", () => {
    expect(tierFromSignals(base)).toBe("basique");
  });
  it("vérifié avec le téléphone vérifié", () => {
    expect(tierFromSignals({ ...base, phoneVerified: true })).toBe("verifie");
  });
  it("certifié dès qu'un pro valide une mise en relation", () => {
    expect(tierFromSignals({ ...base, phoneVerified: true, proValidations: 1 })).toBe("certifie_confiance");
  });
  it("certifié avec une étude approuvée par le pro", () => {
    expect(tierFromSignals({ ...base, approvedStudies: 1 })).toBe("certifie_confiance");
  });
});
