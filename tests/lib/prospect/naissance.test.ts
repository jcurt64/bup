import { describe, expect, it } from "vitest";
import { ageFromBirth, normalizeNaissance, parseBirth } from "@/lib/prospect/naissance";

describe("parseBirth", () => {
  it("lit MM/AAAA et les anciens formats", () => {
    expect(parseBirth("06/1988")).toEqual({ year: 1988, month: 6 });
    expect(parseBirth("14/06/1988")).toEqual({ year: 1988, month: 6 });
    expect(parseBirth("1988-06-14")).toEqual({ year: 1988, month: 6 });
  });
  it("rejette l'invalide", () => {
    expect(parseBirth("13/1988")).toBeNull();
    expect(parseBirth("Juin 1988")).toBeNull();
    expect(parseBirth("")).toBeNull();
    expect(parseBirth(null)).toBeNull();
  });
});

describe("ageFromBirth", () => {
  const ref = new Date(2026, 8, 23); // 23/09/2026
  it("compte l'anniversaire au 1er du mois", () => {
    expect(ageFromBirth("09/1990", ref)).toBe(36);
    expect(ageFromBirth("10/1990", ref)).toBe(35);
    expect(ageFromBirth("25/09/1990", ref)).toBe(36);
  });
});

describe("normalizeNaissance", () => {
  it("normalise en MM/AAAA", () => {
    expect(normalizeNaissance("06/1988")).toBe("06/1988");
    expect(normalizeNaissance("14/06/1988")).toBe("06/1988");
  });
  it("refuse futur et trop ancien", () => {
    expect(normalizeNaissance(`01/${new Date().getFullYear() + 1}`)).toBeNull();
    expect(normalizeNaissance("01/1850")).toBeNull();
  });
});
