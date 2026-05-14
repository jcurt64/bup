import { describe, it, expect } from "vitest";
import {
  computeRoi,
  ROI_ASSUMED_CONVERSION_PCT,
  ROI_ASSUMED_VALUE_PER_CLIENT_CENTS,
} from "@/lib/pro/roi";

describe("computeRoi", () => {
  it("renvoie pct=null quand aucune dépense (évite la division par zéro)", () => {
    const r = computeRoi(0, 0);
    expect(r.pct).toBeNull();
    expect(r.spentCents).toBe(0);
    expect(r.potentialRevenueCents).toBe(0);
  });

  it("renvoie pct=null quand aucune dépense même avec des acceptations (cas anormal)", () => {
    const r = computeRoi(0, 5);
    expect(r.pct).toBeNull();
  });

  it("calcule un ROI très positif pour un palier bas (1 €/contact)", () => {
    // 10 contacts × 1 € = 10 € de dépense
    // 10 contacts × 10 % × 100 € = 100 € de gains potentiels
    // ROI = (100 − 10) / 10 = +900 %
    const r = computeRoi(1_000, 10);
    expect(r.pct).toBe(900);
    expect(r.spentCents).toBe(1_000);
    expect(r.potentialRevenueCents).toBe(10_000);
  });

  it("ROI à 0 % quand gains potentiels = dépenses (palier 5 maxi)", () => {
    // 10 contacts × 10 € = 100 € de dépense
    // 10 contacts × 10 % × 100 € = 100 € de gains
    const r = computeRoi(10_000, 10);
    expect(r.pct).toBe(0);
  });

  it("ROI négatif quand dépense > gains potentiels", () => {
    // 10 contacts × 20 € (palier 5 + multiplicateur durée) = 200 € de dépense
    // 10 contacts × 10 % × 100 € = 100 € de gains
    // ROI = (100 − 200) / 200 = −50 %
    const r = computeRoi(20_000, 10);
    expect(r.pct).toBe(-50);
  });

  it("expose les hypothèses appliquées pour transparence UI", () => {
    const r = computeRoi(5_000, 5);
    expect(r.assumedConversionPct).toBe(ROI_ASSUMED_CONVERSION_PCT);
    expect(r.assumedValuePerClientCents).toBe(ROI_ASSUMED_VALUE_PER_CLIENT_CENTS);
  });

  it("arrondit le pourcentage à l'entier le plus proche", () => {
    // 7 contacts × 100 € × 10 % = 70 € potentiels
    // Dépense : 47 € → ROI = (70 − 47) / 47 = 0.4893… → 49
    const r = computeRoi(4_700, 7);
    expect(r.pct).toBe(49);
  });
});
