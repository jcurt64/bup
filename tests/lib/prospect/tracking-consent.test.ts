import { describe, expect, it } from "vitest";
import {
  objectiveIdOf,
  parseDecisionPlatform,
  requiresTrackingConsent,
} from "@/lib/prospect/tracking-consent";

describe("requiresTrackingConsent", () => {
  it("bloque une campagne addigital sur iOS sans autorisation ATT", () => {
    expect(requiresTrackingConsent("addigital", "ios", false)).toBe(true);
    expect(requiresTrackingConsent("addigital", "ios", undefined)).toBe(true);
    expect(requiresTrackingConsent("addigital", "ios", null)).toBe(true);
  });
  it("laisse passer si l'ATT est accordée", () => {
    expect(requiresTrackingConsent("addigital", "ios", true)).toBe(false);
  });
  it("ne concerne que iOS", () => {
    expect(requiresTrackingConsent("addigital", "android", false)).toBe(false);
    expect(requiresTrackingConsent("addigital", "web", false)).toBe(false);
    expect(requiresTrackingConsent("addigital", null, false)).toBe(false);
  });
  it("ne concerne que la publicité digitale", () => {
    expect(requiresTrackingConsent("prospection", "ios", false)).toBe(false);
    expect(requiresTrackingConsent(null, "ios", false)).toBe(false);
  });
});

describe("objectiveIdOf / parseDecisionPlatform", () => {
  it("lit objectiveId de façon défensive", () => {
    expect(objectiveIdOf({ objectiveId: "addigital" })).toBe("addigital");
    expect(objectiveIdOf({ objectiveId: 3 })).toBeNull();
    expect(objectiveIdOf({ objectiveId: "" })).toBeNull();
    expect(objectiveIdOf(null)).toBeNull();
  });
  it("normalise la plateforme", () => {
    expect(parseDecisionPlatform("ios")).toBe("ios");
    expect(parseDecisionPlatform("android")).toBe("android");
    expect(parseDecisionPlatform("web")).toBe("web");
    expect(parseDecisionPlatform("IOS")).toBeNull();
    expect(parseDecisionPlatform(undefined)).toBeNull();
  });
});
