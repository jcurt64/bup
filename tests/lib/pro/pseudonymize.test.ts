import { describe, expect, it } from "vitest";
import { initialToken, applyKind, pseudonymizeTierItems } from "@/lib/pro/pseudonymize";

describe("initialToken", () => {
  it("ne garde que l'initiale majuscule suivie d'un point", () => {
    expect(initialToken("Dubois")).toBe("D.");
    expect(initialToken("d")).toBe("D.");
    expect(initialToken("élodie")).toBe("É.");
  });
  it("renvoie null si vide", () => {
    expect(initialToken("")).toBeNull();
    expect(initialToken(null)).toBeNull();
    expect(initialToken("   ")).toBeNull();
  });
});

describe("applyKind", () => {
  it("conserve", () => expect(applyKind("keep", " Marie ")).toBe("Marie"));
  it("initiale", () => expect(applyKind("initial", "Martin")).toBe("M."));
  it("alias renvoie null (injecté par la route)", () =>
    expect(applyKind("alias", "a@b.fr")).toBeNull());
});

describe("pseudonymizeTierItems", () => {
  const raw = {
    prenom: "Marie",
    nom: "D",
    email: "marie@example.com",
    telephone: "0601020304",
  };

  it("renvoie prénom + initiale + alias e-mail, jamais le téléphone ni l'e-mail brut", () => {
    const items = pseudonymizeTierItems("identity", raw, { aliasEmail: "prospect+rabc@buupp.com" });
    expect(items).toEqual([
      { label: "Prénom", value: "Marie" },
      { label: "Nom", value: "D." },
      { label: "E-mail (alias sécurisé)", value: "prospect+rabc@buupp.com" },
    ]);
    const flat = JSON.stringify(items);
    expect(flat).not.toContain("0601020304");
    expect(flat).not.toContain("marie@example.com");
  });

  it("omet l'e-mail si la campagne n'a pas le canal e-mail", () => {
    const items = pseudonymizeTierItems("identity", raw, {
      aliasEmail: "prospect+rabc@buupp.com",
      channels: ["phone"],
    });
    expect(items.map((i) => i.label)).toEqual(["Prénom", "Nom"]);
  });
});
