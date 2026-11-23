import { describe, it, expect } from "vitest";
import { haversineMeters } from "@/lib/geo/geocode";

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
