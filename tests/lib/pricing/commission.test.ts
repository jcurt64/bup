import { describe, it, expect } from "vitest";
import {
  commissionCents,
  campaignCommissionMaxCents,
  COMMISSION_FLOOR_CENTS,
  COMMISSION_RATE_BP,
} from "@/lib/pricing/commission";

describe("commissionCents — 10 % avec plancher 0,30 €", () => {
  it.each([
    [100, 30], // 1 € → 0,10 € < plancher → 0,30 €
    [200, 30], // 2 € → 0,20 € → 0,30 €
    [300, 30], // 3 € → 0,30 € (égalité)
    [500, 50], // 5 € → 0,50 €
    [1000, 100], // 10 € → 1,00 €
  ])("rémunération %i c → commission %i c", (reward, expected) => {
    expect(commissionCents(reward)).toBe(expected);
  });

  it("arrondit au centime le plus proche (demi vers le haut)", () => {
    expect(commissionCents(355)).toBe(36); // 35,5 → 36
    expect(commissionCents(354)).toBe(35); // 35,4 → 35
    expect(commissionCents(1505)).toBe(151); // 150,5 → 151
  });

  it("rémunération nulle ou invalide → 0", () => {
    expect(commissionCents(0)).toBe(0);
    expect(commissionCents(-100)).toBe(0);
    expect(commissionCents(Number.NaN)).toBe(0);
  });

  it("utilise le tarif figé de la campagne quand fourni", () => {
    expect(commissionCents(1000, 1500, 50)).toBe(150);
    expect(commissionCents(100, 1500, 50)).toBe(50);
  });

  it("constantes par défaut", () => {
    expect(COMMISSION_RATE_BP).toBe(1000);
    expect(COMMISSION_FLOOR_CENTS).toBe(30);
  });
});

describe("campaignCommissionMaxCents", () => {
  it("contacts × commission unitaire", () => {
    expect(campaignCommissionMaxCents(10, 100)).toBe(300); // 10 × 0,30 €
    expect(campaignCommissionMaxCents(10, 1000)).toBe(1000); // 10 × 1,00 €
  });
  it("0 contact → 0", () => {
    expect(campaignCommissionMaxCents(0, 500)).toBe(0);
  });
});
