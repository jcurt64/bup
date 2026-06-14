import { describe, expect, it } from "vitest";
import {
  maskToken,
  ageRange,
  postalToDept,
  animalCategory,
  distanceBand,
  applyKind,
  pseudonymizeTierItems,
} from "@/lib/pro/pseudonymize";

describe("maskToken", () => {
  it("garde l'initiale et masque le reste", () => {
    expect(maskToken("Marie")).toBe("M••••");
    expect(maskToken("Dubois")).toBe("D•••••");
  });
  it("met l'initiale en majuscule", () => {
    expect(maskToken("marie")).toBe("M••••");
  });
  it("plafonne le nombre de points à 5", () => {
    expect(maskToken("Maximilien")).toBe("M•••••");
  });
  it("garde au moins 2 points pour les valeurs courtes", () => {
    expect(maskToken("Bo")).toBe("B••");
    expect(maskToken("A")).toBe("A••");
  });
  it("renvoie null si vide", () => {
    expect(maskToken("")).toBeNull();
    expect(maskToken(null)).toBeNull();
    expect(maskToken("   ")).toBeNull();
  });
});

describe("ageRange", () => {
  const ref = new Date("2026-06-14T00:00:00Z");
  it("généralise une date JJ/MM/AAAA en tranche de 5 ans", () => {
    // né le 12/04/1990 → au 14/06/2026 il a 36 ans → palier 32–37
    expect(ageRange("12/04/1990", ref)).toBe("32–37 ans");
  });
  it("gère le format AAAA-MM-JJ", () => {
    expect(ageRange("1990-04-12", ref)).toBe("32–37 ans");
  });
  it("retranche un an si l'anniversaire n'est pas encore passé", () => {
    // né le 31/12/1996 → au 14/06/2026 il a 29 ans → palier 27–32
    expect(ageRange("31/12/1996", ref)).toBe("27–32 ans");
  });
  it("renvoie null pour une date invalide", () => {
    expect(ageRange("pas une date", ref)).toBeNull();
    expect(ageRange("", ref)).toBeNull();
    expect(ageRange(null, ref)).toBeNull();
  });
});

describe("postalToDept", () => {
  it("généralise un code postal métropolitain en département", () => {
    expect(postalToDept("69002")).toBe("69 · Rhône");
    expect(postalToDept("75011")).toBe("75 · Paris");
    expect(postalToDept("13006")).toBe("13 · Bouches-du-Rhône");
  });
  it("gère l'Outre-mer sur 3 chiffres", () => {
    expect(postalToDept("97400")).toBe("974 · La Réunion");
  });
  it("renvoie le code seul si département inconnu", () => {
    expect(postalToDept("99123")).toBe("99");
  });
  it("renvoie null si vide", () => {
    expect(postalToDept("")).toBeNull();
    expect(postalToDept(null)).toBeNull();
  });
});

describe("animalCategory", () => {
  it("retire la race et ne garde que la présence", () => {
    expect(animalCategory("Oui · Chien")).toBe("Animal de compagnie");
    expect(animalCategory("Chat")).toBe("Animal de compagnie");
  });
  it("détecte l'absence d'animal", () => {
    expect(animalCategory("Non")).toBe("Aucun");
    expect(animalCategory("Aucun")).toBe("Aucun");
  });
  it("renvoie null si vide", () => {
    expect(animalCategory(null)).toBeNull();
  });
});

describe("distanceBand", () => {
  it("borne la distance en tranches", () => {
    expect(distanceBand(800)).toBe("< 2 km du centre");
    expect(distanceBand(3500)).toBe("2–5 km du centre");
    expect(distanceBand(7000)).toBe("5–10 km du centre");
    expect(distanceBand(15000)).toBe("10–20 km du centre");
    expect(distanceBand(40000)).toBe("> 20 km du centre");
  });
  it("renvoie null si distance absente ou invalide", () => {
    expect(distanceBand(null)).toBeNull();
    expect(distanceBand(undefined)).toBeNull();
    expect(distanceBand(-5)).toBeNull();
  });
});

describe("applyKind", () => {
  it("conserve", () => expect(applyKind("keep", "Lyon")).toBe("Lyon"));
  it("supprime", () => expect(applyKind("suppress", "12 rue X")).toBeNull());
  it("alias renvoie null (injecté par la route)", () =>
    expect(applyKind("alias", "marie@email.fr")).toBeNull());
});

describe("pseudonymizeTierItems", () => {
  it("pseudonymise le palier identité selon les règles", () => {
    const items = pseudonymizeTierItems(
      "identity",
      {
        prenom: "Marie",
        nom: "Dubois",
        email: "marie@email.fr",
        telephone: "06 12 34 56 78",
        naissance: "12/04/1990",
      },
      { aliasEmail: "prospect+rabc123@buupp.com" },
    );
    expect(items).toEqual([
      { label: "Prénom", value: "Marie" },
      { label: "Nom", value: "D•••••" },
      { label: "E-mail (alias sécurisé)", value: "prospect+rabc123@buupp.com" },
      { label: "Téléphone", value: "06 12 34 56 78" },
      // la tranche d'âge dépend de la date du jour → on vérifie juste le format
      { label: "Tranche d'âge", value: items[4].value },
    ]);
    expect(items[4].value).toMatch(/^\d{1,3}–\d{1,3} ans$/);
  });

  it("généralise l'adresse en distance au centre + le code postal en département", () => {
    const items = pseudonymizeTierItems("localisation", {
      adresse: "12 rue de la République",
      ville: "Lyon",
      code_postal: "69002",
      region: "Auvergne-Rhône-Alpes",
      center_distance_m: 1200,
    });
    expect(items).toContainEqual({ label: "Zone", value: "< 2 km du centre" });
    expect(items).toContainEqual({ label: "Ville", value: "Lyon" });
    expect(items).toContainEqual({ label: "Département", value: "69 · Rhône" });
    expect(items).toContainEqual({
      label: "Région",
      value: "Auvergne-Rhône-Alpes",
    });
    // L'adresse précise n'est jamais exposée telle quelle.
    expect(items.some((i) => i.value === "12 rue de la République")).toBe(false);
  });

  it("omet la zone si l'adresse n'a pas (encore) été géocodée", () => {
    const items = pseudonymizeTierItems("localisation", {
      adresse: "12 rue de la République",
      ville: "Lyon",
      code_postal: "69002",
    });
    expect(items.find((i) => i.label === "Zone")).toBeUndefined();
    expect(items).toContainEqual({ label: "Ville", value: "Lyon" });
  });

  it("ne transmet ni poste ni revenus (palier pro)", () => {
    const items = pseudonymizeTierItems("pro", {
      poste: "Responsable marketing",
      statut: "Cadre",
      secteur: "Industrie manufacturière",
      revenus: "3 200 €/mois",
    });
    expect(items.map((i) => i.label)).toEqual(["Statut", "Secteur"]);
  });
});
