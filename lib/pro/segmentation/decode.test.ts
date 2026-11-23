import { describe, it, expect } from "vitest";
import { decodeContacts, type DecodeInput } from "./decode";

function input(over: Partial<DecodeInput> = {}): DecodeInput {
  return {
    relations: [{ relationId: "r1", prospectId: "p1", score: 730, evaluation: "atteint" }],
    identityByProspect: new Map([["p1", { prenom: "Léa", nom: "Martin" }]]),
    ...over,
  };
}

describe("decodeContacts", () => {
  it("decodes prénom + nom INITIAL only", () => {
    const [c] = decodeContacts(input());
    expect(c.relationId).toBe("r1");
    expect(c.score).toBe(730);
    expect(c.reached).toBe("atteint");
    expect(c.identity).toEqual({ prenom: "Léa", nom: "M" });
  });

  it("trims empty strings to null and tolerates missing identity rows", () => {
    const [a] = decodeContacts(input({ identityByProspect: new Map([["p1", { prenom: "  ", nom: "élodie" }]]) }));
    expect(a.identity).toEqual({ prenom: null, nom: "É" });
    const [b] = decodeContacts(input({ identityByProspect: new Map() }));
    expect(b.identity).toEqual({ prenom: null, nom: null });
  });

  it("never exposes legacy tier blocks", () => {
    const [c] = decodeContacts(input());
    expect(Object.keys(c).sort()).toEqual(["identity", "reached", "relationId", "score"]);
  });
});
