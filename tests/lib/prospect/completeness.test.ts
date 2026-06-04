import { describe, it, expect } from "vitest";
import {
  REQUIRED_TIER_FIELDS,
  TIER_NUM_TO_KEY,
  normalizeRequiredTierNums,
  isTierRowComplete,
  missingRequiredTierNums,
} from "@/lib/prospect/completeness";

const fullIdentity = {
  prenom: "Marie",
  nom: "Lemaire",
  email: "marie@example.com",
  telephone: "0600000000",
  naissance: "1990-01-01",
};

const fullVie = {
  foyer: "Famille",
  logement: "Maison",
  mobilite: "Voiture",
  vehicule: "Berline",
  sports: "Course",
  animaux: "Non",
};

describe("isTierRowComplete", () => {
  it("true quand tous les champs requis sont remplis", () => {
    expect(isTierRowComplete("identity", fullIdentity)).toBe(true);
  });

  it("false dès qu'un seul champ requis manque", () => {
    expect(isTierRowComplete("identity", { ...fullIdentity, telephone: "" })).toBe(false);
    expect(isTierRowComplete("identity", { ...fullIdentity, telephone: "   " })).toBe(false);
    expect(isTierRowComplete("identity", { ...fullIdentity, nom: null })).toBe(false);
  });

  it("false quand la row n'existe pas", () => {
    expect(isTierRowComplete("identity", null)).toBe(false);
    expect(isTierRowComplete("vie", undefined)).toBe(false);
  });

  it("ne prend pas en compte les sous-champs de détail optionnels", () => {
    // animaux_detail / vehicule_marque ne sont pas requis.
    expect(REQUIRED_TIER_FIELDS.vie).not.toContain("animaux_detail");
    expect(REQUIRED_TIER_FIELDS.vie).not.toContain("vehicule_marque");
    expect(isTierRowComplete("vie", fullVie)).toBe(true);
  });
});

describe("normalizeRequiredTierNums", () => {
  it("défaut [1] (identité) si absent/vide/invalide", () => {
    expect(normalizeRequiredTierNums(undefined)).toEqual([1]);
    expect(normalizeRequiredTierNums([])).toEqual([1]);
    expect(normalizeRequiredTierNums([9, 0, -1])).toEqual([1]);
    expect(normalizeRequiredTierNums("nope")).toEqual([1]);
  });

  it("dédoublonne, trie et borne 1..5", () => {
    expect(normalizeRequiredTierNums([3, 1, 3, 5])).toEqual([1, 3, 5]);
    expect(normalizeRequiredTierNums([5, 2, 8, 2])).toEqual([2, 5]);
  });
});

describe("missingRequiredTierNums", () => {
  it("renvoie les paliers requis non intégralement renseignés", () => {
    const rows = {
      identity: fullIdentity,
      vie: { ...fullVie, sports: "" }, // incomplet
    };
    expect(missingRequiredTierNums([1, 3], rows)).toEqual([3]);
  });

  it("vide quand tous les paliers requis sont complets", () => {
    const rows = { identity: fullIdentity, vie: fullVie };
    expect(missingRequiredTierNums([1, 3], rows)).toEqual([]);
  });

  it("un palier requis sans row du tout est manquant", () => {
    expect(missingRequiredTierNums([1, 4], { identity: fullIdentity })).toEqual([4]);
  });
});

describe("TIER_NUM_TO_KEY", () => {
  it("mappe 1..5 vers les bonnes clés", () => {
    expect(TIER_NUM_TO_KEY).toEqual({
      1: "identity",
      2: "localisation",
      3: "vie",
      4: "pro",
      5: "patrimoine",
    });
  });
});
