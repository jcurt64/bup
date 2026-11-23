import { describe, it, expect } from "vitest";
import {
  classifyVerifWiden,
  classifyFiabiliteWiden,
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
