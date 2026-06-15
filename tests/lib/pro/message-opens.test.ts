import { describe, it, expect } from "vitest";
import { computeMessageOpenStats } from "@/lib/pro/message-opens";

describe("computeMessageOpenStats", () => {
  it("renvoie tout à zéro et rate=null quand aucun envoi", () => {
    const r = computeMessageOpenStats([]);
    expect(r).toEqual({ sent: 0, trackable: 0, opened: 0, rate: null });
  });

  it("rate=null quand aucun envoi traçable (aucun consentement)", () => {
    const r = computeMessageOpenStats([
      { emailOpenedAt: null, trackingPixelEmbedded: false },
      { emailOpenedAt: null, trackingPixelEmbedded: false },
    ]);
    expect(r.sent).toBe(2);
    expect(r.trackable).toBe(0);
    expect(r.opened).toBe(0);
    expect(r.rate).toBeNull();
  });

  it("calcule le taux sur les seuls envois traçables (exclut les non-consentis)", () => {
    // 4 envoyés : 2 traçables (consentis) dont 1 ouvert, 2 non traçables.
    const r = computeMessageOpenStats([
      { emailOpenedAt: "2026-06-15T10:00:00Z", trackingPixelEmbedded: true },
      { emailOpenedAt: null, trackingPixelEmbedded: true },
      { emailOpenedAt: null, trackingPixelEmbedded: false },
      { emailOpenedAt: null, trackingPixelEmbedded: false },
    ]);
    expect(r.sent).toBe(4);
    expect(r.trackable).toBe(2);
    expect(r.opened).toBe(1);
    expect(r.rate).toBe(50);
  });

  it("compte comme traçable un historique sans flag mais ouvert (opened ⊆ trackable)", () => {
    const r = computeMessageOpenStats([
      { emailOpenedAt: "2026-06-15T10:00:00Z", trackingPixelEmbedded: null },
      { emailOpenedAt: null, trackingPixelEmbedded: null },
    ]);
    expect(r.sent).toBe(2);
    expect(r.trackable).toBe(1);
    expect(r.opened).toBe(1);
    expect(r.rate).toBe(100);
  });

  it("arrondit le taux à l'entier le plus proche", () => {
    // 1 ouvert / 3 traçables = 33.33 % → 33
    const r = computeMessageOpenStats([
      { emailOpenedAt: "x", trackingPixelEmbedded: true },
      { emailOpenedAt: null, trackingPixelEmbedded: true },
      { emailOpenedAt: null, trackingPixelEmbedded: true },
    ]);
    expect(r.rate).toBe(33);
  });

  it("taux à 100 % quand tous les traçables sont ouverts", () => {
    const r = computeMessageOpenStats([
      { emailOpenedAt: "a", trackingPixelEmbedded: true },
      { emailOpenedAt: "b", trackingPixelEmbedded: true },
    ]);
    expect(r).toEqual({ sent: 2, trackable: 2, opened: 2, rate: 100 });
  });
});
