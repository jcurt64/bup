import { describe, expect, it } from "vitest";
import {
  NON_RESPONSE_THRESHOLDS,
  SCORE_MALUS_POINTS,
  RESTRICTION_MONTHS,
  escalationSteps,
  restrictionUntil,
  isRestrictionExpired,
  formatDateFr,
} from "@/lib/prospect/non-response";

describe("constantes", () => {
  it("seuils 2/3/4, malus -100, restriction 2 mois", () => {
    expect(NON_RESPONSE_THRESHOLDS).toEqual({ signalement: 2, scoreMalus: 3, restriction: 4 });
    expect(SCORE_MALUS_POINTS).toBe(100);
    expect(RESTRICTION_MONTHS).toBe(2);
  });
});

describe("escalationSteps", () => {
  it("aucun palier sous 2 strikes", () => {
    expect(escalationSteps(0, 0)).toEqual([]);
    expect(escalationSteps(1, 0)).toEqual([]);
  });
  it("franchit un palier à la fois", () => {
    expect(escalationSteps(2, 0)).toEqual([2]);
    expect(escalationSteps(3, 2)).toEqual([3]);
    expect(escalationSteps(4, 3)).toEqual([4]);
  });
  it("idempotent : un palier déjà appliqué ne refire pas", () => {
    expect(escalationSteps(2, 2)).toEqual([]);
    expect(escalationSteps(3, 3)).toEqual([]);
    expect(escalationSteps(4, 4)).toEqual([]);
  });
  it("applique tous les paliers franchis en cas de saut", () => {
    expect(escalationSteps(4, 0)).toEqual([2, 3, 4]);
    expect(escalationSteps(3, 0)).toEqual([2, 3]);
  });
  it("plafonné au niveau 4 (strikes au-delà ne créent rien)", () => {
    expect(escalationSteps(5, 4)).toEqual([]);
    expect(escalationSteps(9, 4)).toEqual([]);
  });
});

describe("restrictionUntil", () => {
  it("ajoute 2 mois calendaires", () => {
    const now = new Date("2026-06-05T10:00:00.000Z");
    expect(restrictionUntil(now).toISOString()).toBe("2026-08-05T10:00:00.000Z");
  });
  it("gère le débordement de mois", () => {
    const now = new Date("2026-12-15T08:00:00.000Z");
    // +2 mois → février de l'année suivante
    expect(restrictionUntil(now).toISOString()).toBe("2027-02-15T08:00:00.000Z");
  });
});

describe("isRestrictionExpired", () => {
  const now = new Date("2026-06-05T12:00:00.000Z");
  it("false si pas de restriction", () => {
    expect(isRestrictionExpired(null, now)).toBe(false);
    expect(isRestrictionExpired(undefined, now)).toBe(false);
  });
  it("false si la restriction est encore active", () => {
    expect(isRestrictionExpired("2026-08-05T12:00:00.000Z", now)).toBe(false);
  });
  it("true si la restriction est passée", () => {
    expect(isRestrictionExpired("2026-06-04T12:00:00.000Z", now)).toBe(true);
  });
  it("ignore une valeur non parsable", () => {
    expect(isRestrictionExpired("pas-une-date", now)).toBe(false);
  });
});

describe("formatDateFr", () => {
  it("formate en JJ/MM/AAAA (UTC)", () => {
    expect(formatDateFr("2026-08-05T10:00:00.000Z")).toBe("05/08/2026");
  });
});
