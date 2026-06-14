import { describe, it, expect } from "vitest";
import { decodeContacts, type DecodeInput } from "./decode";
import type { TierKey } from "./types";

function input(over: Partial<DecodeInput> = {}): DecodeInput {
  return {
    relations: [{ relationId: "r1", prospectId: "p1", score: 730, evaluation: "atteint" }],
    blockedByProspect: new Map(),
    tierData: {
      identity: new Map([["p1", { prenom: "Léa", nom: "Martin" }]]),
      localisation: new Map([["p1", { region: "Rhône", ville: "Lyon", code_postal: "69003", adresse: "1 rue X", center_distance_m: 1200 }]]),
      pro: new Map([["p1", { poste: "Dev", statut: "Salarié", secteur: "Tech", revenus: "30-40k" }]]),
    },
    campaignTiers: ["identity", "localisation", "pro"] as TierKey[],
    ...over,
  };
}

describe("decodeContacts", () => {
  it("decodes allowed tiers into structured blocks", () => {
    const [c] = decodeContacts(input());
    expect(c.relationId).toBe("r1");
    expect(c.score).toBe(730);
    expect(c.reached).toBe("atteint");
    expect(c.identity).toEqual({ prenom: "Léa", nom: "Martin" });
    expect(c.localisation?.region).toBe("Rhône");
    expect(c.localisation?.codePostal).toBe("69003");
    expect(c.localisation?.centerDistanceM).toBe(1200);
    expect(c.pro?.revenus).toBe("30-40k");
  });

  it("omits tiers not purchased by the campaign", () => {
    const [c] = decodeContacts(input({ campaignTiers: ["identity"] as TierKey[] }));
    expect(c.identity).toBeDefined();
    expect(c.localisation).toBeUndefined();
    expect(c.pro).toBeUndefined();
  });

  it("omits tiers the prospect blocked (removed/hidden)", () => {
    const blocked = new Map([["p1", new Set<TierKey>(["pro"])]]);
    const [c] = decodeContacts(input({ blockedByProspect: blocked }));
    expect(c.localisation).toBeDefined();
    expect(c.pro).toBeUndefined();
  });

  it("trims empty strings to null and tolerates missing tier rows", () => {
    const [c] = decodeContacts(
      input({ tierData: { identity: new Map([["p1", { prenom: "  ", nom: "Martin" }]]) }, campaignTiers: ["identity"] as TierKey[] }),
    );
    expect(c.identity).toEqual({ prenom: null, nom: "Martin" });
  });
});
