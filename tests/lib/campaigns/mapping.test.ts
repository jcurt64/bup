import { describe, it, expect } from "vitest";
import {
  AROUND_RADII,
  AROUND_RADIUS_DEFAULT,
  normalizeRadiusKm,
  geoRadiusFloorKm,
} from "@/lib/campaigns/mapping";
import { haversineMeters } from "@/lib/geo/geocode";

describe("normalizeRadiusKm (ciblage « autour de moi »)", () => {
  it("accepte les rayons autorisés 10/30/50 tels quels", () => {
    expect(normalizeRadiusKm(10)).toBe(10);
    expect(normalizeRadiusKm(30)).toBe(30);
    expect(normalizeRadiusKm(50)).toBe(50);
  });

  it("retombe sur le défaut (10 km) pour une valeur hors-liste", () => {
    expect(normalizeRadiusKm(20)).toBe(AROUND_RADIUS_DEFAULT);
    expect(normalizeRadiusKm(1000)).toBe(AROUND_RADIUS_DEFAULT);
    expect(normalizeRadiusKm(0)).toBe(AROUND_RADIUS_DEFAULT);
    expect(normalizeRadiusKm(-5)).toBe(AROUND_RADIUS_DEFAULT);
  });

  it("retombe sur le défaut pour des entrées non numériques / nulles", () => {
    expect(normalizeRadiusKm(null)).toBe(AROUND_RADIUS_DEFAULT);
    expect(normalizeRadiusKm(undefined)).toBe(AROUND_RADIUS_DEFAULT);
    expect(normalizeRadiusKm("abc")).toBe(AROUND_RADIUS_DEFAULT);
    expect(normalizeRadiusKm(NaN)).toBe(AROUND_RADIUS_DEFAULT);
  });

  it("parse une chaîne numérique autorisée", () => {
    expect(normalizeRadiusKm("30")).toBe(30);
  });

  it("AROUND_RADII expose exactement 10/30/50", () => {
    expect([...AROUND_RADII]).toEqual([10, 30, 50]);
  });
});

describe("geoRadiusFloorKm — « around » délègue au filtre distance", () => {
  it("renvoie null pour around (pas de plancher de rayon prospect)", () => {
    expect(geoRadiusFloorKm("around")).toBeNull();
  });

  it("conserve les planchers existants des portées administratives", () => {
    expect(geoRadiusFloorKm("ville")).toBe(25);
    expect(geoRadiusFloorKm("dept")).toBe(50);
    expect(geoRadiusFloorKm("region")).toBe(100);
    expect(geoRadiusFloorKm("national")).toBeNull();
  });
});

describe("haversineMeters — base du matching « autour de moi »", () => {
  it("distance nulle entre un point et lui-même", () => {
    const p = { lat: 44.8378, lng: -0.5792 }; // Bordeaux
    expect(haversineMeters(p, p)).toBe(0);
  });

  it("mesure une distance grande-cercle plausible (Paris ↔ Lyon ≈ 392 km)", () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    const lyon = { lat: 45.764, lng: 4.8357 };
    const m = haversineMeters(paris, lyon);
    expect(m).toBeGreaterThan(385_000);
    expect(m).toBeLessThan(400_000);
  });

  it("franchit le seuil de rayon : 30 km autour exclut un point à ~40 km", () => {
    // ~0,36° de latitude ≈ 40 km ; au-delà d'un rayon de 30 km → exclu.
    const pro = { lat: 44.84, lng: -0.58 };
    const loin = { lat: 45.2, lng: -0.58 };
    expect(haversineMeters(pro, loin)).toBeGreaterThan(30_000);
  });
});
