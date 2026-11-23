import { describe, it, expect } from "vitest";
import {
  REQUIRED_TIER_FIELDS,
  isContactProfileComplete,
  missingContactFields,
  missingTierNumsForIdentity,
} from "@/lib/prospect/completeness";

const full = {
  prenom: "Marie",
  nom: "L",
  ville: "Lyon",
  genre: "femme",
  tranche_age: "18-35",
  email: "marie@example.com",
  telephone: "0600000000",
};

const ALL = ["prenom", "nom", "ville", "genre", "trancheAge", "email", "telephone"];

const REQUIRED = ["prenom", "nom", "email", "telephone"];

describe("garde d'acceptation (4 champs requis)", () => {
  it("exige prénom, initiale, e-mail et téléphone", () => {
    expect(REQUIRED_TIER_FIELDS.identity).toEqual(REQUIRED);
  });

  it("complet quand les 7 champs sont remplis", () => {
    expect(isContactProfileComplete(full)).toBe(true);
    expect(missingContactFields(full)).toEqual([]);
    expect(missingTierNumsForIdentity(full)).toEqual([]);
  });

  it("ville / sexe / tranche d'âge facultatifs pour accepter", () => {
    expect(
      isContactProfileComplete({ ...full, ville: null, genre: null, tranche_age: null }),
    ).toBe(true);
  });

  it("incomplet si un champ requis manque ou n'est que des espaces", () => {
    expect(isContactProfileComplete({ ...full, telephone: null })).toBe(false);
    expect(missingContactFields({ ...full, nom: "  " })).toEqual(["nom"]);
    expect(missingTierNumsForIdentity({ ...full, email: "" })).toEqual([1]);
  });

  it("incomplet sans ligne identité", () => {
    expect(isContactProfileComplete(null)).toBe(false);
    expect(missingContactFields(undefined)).toEqual(REQUIRED);
  });
});

describe("profil prospect (7 champs, complétude)", () => {
  it("liste explicite des 7 champs", () => {
    expect(missingContactFields(undefined, ALL as never)).toEqual(ALL);
    expect(missingContactFields({ ...full, ville: " " }, ALL as never)).toEqual(["ville"]);
  });

  it("genre / tranche d'âge hors valeurs connues = manquants", () => {
    expect(missingContactFields({ ...full, genre: "x" }, ALL as never)).toEqual(["genre"]);
    expect(missingContactFields({ ...full, tranche_age: "50+" }, ALL as never)).toEqual(["trancheAge"]);
  });
});
