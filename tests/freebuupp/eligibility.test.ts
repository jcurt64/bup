import { describe, it, expect } from "vitest";
import { canJoin } from "@/lib/freebuupp/eligibility";

const base = {
  status: "open" as const,
  phoneVerified: true,
  alreadyJoined: false,
  participantCount: 10,
  panelSize: 30,
  geoEligible: true,
};

describe("freebuupp/eligibility.canJoin", () => {
  it("accepte un prospect valide", () => {
    expect(canJoin(base)).toEqual({ ok: true });
  });
  it("refuse si téléphone non vérifié", () => {
    expect(canJoin({ ...base, phoneVerified: false })).toEqual({ ok: false, reason: "phone_unverified" });
  });
  it("refuse si déjà inscrit", () => {
    expect(canJoin({ ...base, alreadyJoined: true })).toEqual({ ok: false, reason: "already_joined" });
  });
  it("refuse si la campagne n'est pas ouverte", () => {
    expect(canJoin({ ...base, status: "closed" })).toEqual({ ok: false, reason: "not_open" });
  });
  it("refuse si le panel est plein", () => {
    expect(canJoin({ ...base, participantCount: 30, panelSize: 30 })).toEqual({ ok: false, reason: "panel_full" });
  });
  it("refuse si hors zone géographique", () => {
    expect(canJoin({ ...base, geoEligible: false })).toEqual({ ok: false, reason: "geo_ineligible" });
  });
  it("priorité : not_open avant les autres", () => {
    expect(canJoin({ ...base, status: "drawn", phoneVerified: false })).toEqual({ ok: false, reason: "not_open" });
  });
});
