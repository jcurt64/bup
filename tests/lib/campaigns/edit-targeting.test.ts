import { describe, it, expect } from "vitest";
import {
  isAllAges,
  validateAgesWiden,
  classifyGeoWiden,
  availableGeoWidenOptions,
  classifyVerifWiden,
  classifyFiabiliteWiden,
  AGE_BUCKETS,
} from "@/lib/campaigns/edit-targeting";

describe("classifyVerifWiden (abaisser l'exigence seulement)", () => {
  it("allows lowering or keeping the level", () => {
    expect(classifyVerifWiden("p1", "p0")).toEqual({ ok: true });
    expect(classifyVerifWiden("p2", "p1")).toEqual({ ok: true });
    expect(classifyVerifWiden("p1", "p1")).toEqual({ ok: true });
  });
  it("rejects raising the level (restriction)", () => {
    expect(classifyVerifWiden("p0", "p1")).toEqual({ ok: false, error: "verif_not_widening" });
    expect(classifyVerifWiden("p1", "p2")).toEqual({ ok: false, error: "verif_not_widening" });
  });
  it("rejects unknown levels", () => {
    expect(classifyVerifWiden("p1", "px")).toEqual({ ok: false, error: "verif_invalid" });
  });
});

describe("classifyFiabiliteWiden (baisser le seuil seulement)", () => {
  it("allows lowering or keeping the threshold", () => {
    expect(classifyFiabiliteWiden(80, 60)).toEqual({ ok: true, value: 60 });
    expect(classifyFiabiliteWiden(80, 0)).toEqual({ ok: true, value: 0 });
    expect(classifyFiabiliteWiden(60, 60)).toEqual({ ok: true, value: 60 });
    expect(classifyFiabiliteWiden(null, 0)).toEqual({ ok: true, value: 0 });
  });
  it("rejects raising the threshold (restriction)", () => {
    expect(classifyFiabiliteWiden(0, 60)).toEqual({ ok: false, error: "fiabilite_not_widening" });
    expect(classifyFiabiliteWiden(60, 80)).toEqual({ ok: false, error: "fiabilite_not_widening" });
  });
  it("rejects out-of-list thresholds", () => {
    expect(classifyFiabiliteWiden(80, 50)).toEqual({ ok: false, error: "fiabilite_invalid" });
  });
});

describe("isAllAges", () => {
  it("treats empty / 'Tous' / full list as the widest", () => {
    expect(isAllAges([])).toBe(true);
    expect(isAllAges(["Tous"])).toBe(true);
    expect(isAllAges([...AGE_BUCKETS])).toBe(true);
  });
  it("is false for a proper subset", () => {
    expect(isAllAges(["26–35"])).toBe(false);
    expect(isAllAges(["18–25", "26–35"])).toBe(false);
  });
});

describe("validateAgesWiden", () => {
  it("accepts adding a bucket (widen)", () => {
    const r = validateAgesWiden(["26–35"], ["26–35", "36–45"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ages).toEqual(["26–35", "36–45"]);
  });

  it("accepts no-op (same selection)", () => {
    const r = validateAgesWiden(["26–35"], ["26–35"]);
    expect(r.ok).toBe(true);
  });

  it("accepts widening to all (returns canonical list + Tous)", () => {
    const r = validateAgesWiden(["26–35"], ["Tous"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ages).toEqual([...AGE_BUCKETS, "Tous"]);
  });

  it("rejects dropping an existing bucket (restriction)", () => {
    const r = validateAgesWiden(["26–35", "36–45"], ["36–45"]);
    expect(r).toEqual({ ok: false, error: "age_not_widening" });
  });

  it("rejects narrowing from 'all' to a subset", () => {
    const r = validateAgesWiden(["Tous"], ["26–35"]);
    expect(r).toEqual({ ok: false, error: "age_not_widening" });
  });

  it("ignores unknown labels in the next set", () => {
    const r = validateAgesWiden(["26–35"], ["26–35", "bogus", "36–45"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ages).toEqual(["26–35", "36–45"]);
  });

  it("orders output canonically regardless of input order", () => {
    const r = validateAgesWiden(["36–45"], ["65+", "18–25", "36–45"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ages).toEqual(["18–25", "36–45", "65+"]);
  });
});

describe("classifyGeoWiden — around", () => {
  it("accepts a strictly larger radius", () => {
    expect(classifyGeoWiden("around", 10, { mode: "around", radiusKm: 30 })).toEqual({
      ok: true,
      plan: { kind: "around", radiusKm: 30 },
    });
  });
  it("rejects same or smaller radius", () => {
    expect(classifyGeoWiden("around", 30, { mode: "around", radiusKm: 30 })).toEqual({
      ok: false,
      error: "geo_not_widening",
    });
    expect(classifyGeoWiden("around", 50, { mode: "around", radiusKm: 30 })).toEqual({
      ok: false,
      error: "geo_not_widening",
    });
  });
  it("rejects an out-of-list radius", () => {
    expect(classifyGeoWiden("around", 10, { mode: "around", radiusKm: 42 })).toEqual({
      ok: false,
      error: "geo_invalid",
    });
  });
  it("rejects around request when current geo is a fixed zone", () => {
    expect(classifyGeoWiden("ville", null, { mode: "around", radiusKm: 50 })).toEqual({
      ok: false,
      error: "geo_invalid",
    });
  });
});

describe("classifyGeoWiden — national", () => {
  it("accepts national from any non-national zone", () => {
    expect(classifyGeoWiden("ville", null, { mode: "national" })).toEqual({
      ok: true,
      plan: { kind: "national" },
    });
    expect(classifyGeoWiden("around", 50, { mode: "national" })).toEqual({
      ok: true,
      plan: { kind: "national" },
    });
  });
  it("rejects national when already national", () => {
    expect(classifyGeoWiden("national", null, { mode: "national" })).toEqual({
      ok: false,
      error: "geo_not_widening",
    });
  });
});

describe("classifyGeoWiden — zone escalation", () => {
  it("ville → dept and ville → region", () => {
    expect(classifyGeoWiden("ville", null, { mode: "zone", level: "dept" })).toEqual({
      ok: true,
      plan: { kind: "zone", level: "dept" },
    });
    expect(classifyGeoWiden("ville", null, { mode: "zone", level: "region" })).toEqual({
      ok: true,
      plan: { kind: "zone", level: "region" },
    });
  });
  it("dept → region", () => {
    expect(classifyGeoWiden("dept", null, { mode: "zone", level: "region" })).toEqual({
      ok: true,
      plan: { kind: "zone", level: "region" },
    });
  });
  it("rejects dept → dept (no widen) and region → dept (restriction)", () => {
    expect(classifyGeoWiden("dept", null, { mode: "zone", level: "dept" })).toEqual({
      ok: false,
      error: "geo_not_widening",
    });
    expect(classifyGeoWiden("region", null, { mode: "zone", level: "dept" })).toEqual({
      ok: false,
      error: "geo_not_widening",
    });
  });
  it("rejects zone escalation from around/national", () => {
    expect(classifyGeoWiden("around", 10, { mode: "zone", level: "dept" })).toEqual({
      ok: false,
      error: "geo_invalid",
    });
    expect(classifyGeoWiden("national", null, { mode: "zone", level: "region" })).toEqual({
      ok: false,
      error: "geo_invalid",
    });
  });
});

describe("availableGeoWidenOptions", () => {
  it("around 10 → {30, 50, national}", () => {
    expect(availableGeoWidenOptions("around", 10)).toEqual([
      { mode: "around", radiusKm: 30 },
      { mode: "around", radiusKm: 50 },
      { mode: "national" },
    ]);
  });
  it("around 50 → {national}", () => {
    expect(availableGeoWidenOptions("around", 50)).toEqual([{ mode: "national" }]);
  });
  it("ville → {dept, region, national}", () => {
    expect(availableGeoWidenOptions("ville", null)).toEqual([
      { mode: "zone", level: "dept" },
      { mode: "zone", level: "region" },
      { mode: "national" },
    ]);
  });
  it("dept → {region, national}", () => {
    expect(availableGeoWidenOptions("dept", null)).toEqual([
      { mode: "zone", level: "region" },
      { mode: "national" },
    ]);
  });
  it("national → {} (nothing to widen)", () => {
    expect(availableGeoWidenOptions("national", null)).toEqual([]);
  });
});
