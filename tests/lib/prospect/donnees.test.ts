import { describe, it, expect } from "vitest";
import { identityRowToUi, parseIdentityPatch } from "@/lib/prospect/donnees";

describe("parseIdentityPatch (PATCH /api/prospect/donnees)", () => {
  it("normalise la ville (espaces, longueur max 120)", () => {
    const r = parseIdentityPatch({ ville: "  Saint-Étienne   du  Rouvray " });
    expect(r).toEqual({ ok: true, row: { ville: "Saint-Étienne du Rouvray" } });
    const long = parseIdentityPatch({ ville: "a".repeat(200) });
    expect(long.ok && long.row.ville?.length).toBe(120);
  });

  it("ville vide / null → null", () => {
    expect(parseIdentityPatch({ ville: "   " })).toEqual({ ok: true, row: { ville: null } });
    expect(parseIdentityPatch({ ville: null })).toEqual({ ok: true, row: { ville: null } });
  });

  it("valide le sexe", () => {
    expect(parseIdentityPatch({ genre: "femme" })).toEqual({ ok: true, row: { genre: "femme" } });
    expect(parseIdentityPatch({ genre: "autre" })).toEqual({ ok: true, row: { genre: "autre" } });
    expect(parseIdentityPatch({ genre: "" })).toEqual({ ok: true, row: { genre: null } });
    expect(parseIdentityPatch({ genre: "F" })).toEqual({ ok: false, error: "invalid_genre" });
    expect(parseIdentityPatch({ genre: 1 })).toEqual({ ok: false, error: "invalid_genre" });
  });

  it("valide la tranche d'âge et la mappe sur tranche_age", () => {
    expect(parseIdentityPatch({ trancheAge: "18-35" })).toEqual({
      ok: true,
      row: { tranche_age: "18-35" },
    });
    expect(parseIdentityPatch({ trancheAge: "35+" })).toEqual({
      ok: true,
      row: { tranche_age: "35+" },
    });
    expect(parseIdentityPatch({ trancheAge: "40-50" })).toEqual({
      ok: false,
      error: "invalid_tranche_age",
    });
  });

  it("réduit le nom à son initiale et ignore les champs inconnus", () => {
    expect(parseIdentityPatch({ nom: "élodie", naissance: "01/1990", foo: "x" })).toEqual({
      ok: true,
      row: { nom: "É" },
    });
  });
});

describe("identityRowToUi", () => {
  it("expose ville / genre / trancheAge", () => {
    expect(
      identityRowToUi({
        prenom: "Marie",
        nom: "Dupont",
        ville: "Lyon",
        genre: "femme",
        tranche_age: "35+",
        email: "m@x.fr",
        telephone: "06",
      }),
    ).toEqual({
      prenom: "Marie",
      nom: "D",
      ville: "Lyon",
      genre: "femme",
      trancheAge: "35+",
      email: "m@x.fr",
      telephone: "06",
    });
  });

  it("valeurs inconnues ou absentes → chaînes vides", () => {
    const ui = identityRowToUi({ genre: "x", tranche_age: "99" });
    expect(ui.genre).toBe("");
    expect(ui.trancheAge).toBe("");
    expect(ui.ville).toBe("");
  });
});
