import { describe, it, expect } from "vitest";
import { findMatchingProspects } from "@/lib/campaigns/matching";

type Call = [string, ...unknown[]];

/** Faux query builder PostgREST : enregistre les appels, renvoie `rows`. */
function fakeAdmin(rows: unknown[]) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "in", "not", "or", "gte", "order"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return builder;
    };
  }
  builder.limit = (...args: unknown[]) => {
    calls.push(["limit", ...args]);
    return Promise.resolve({ data: rows, error: null });
  };
  const admin = { from: () => builder } as never;
  return { admin, calls };
}

const row = (id: string, ident: Record<string, unknown>) => ({
  id,
  verification: "basique",
  prospect_identity: {
    prenom: "A",
    nom: "B",
    email: "a@b.fr",
    telephone: "06",
    ...ident,
  },
});

const baseInput = {
  objectiveId: "contact",
  contactChannels: ["email" as const],
  verifLevel: "p0",
  contacts: 10,
};

describe("findMatchingProspects — filtres d'audience", () => {
  it("sans filtre : aucun filtre ville/genre/tranche, ville non requise", async () => {
    const { admin, calls } = fakeAdmin([row("p1", { ville: null, genre: null, tranche_age: null })]);
    const out = await findMatchingProspects(admin, baseInput);
    expect(out.map((m) => m.prospectId)).toEqual(["p1"]);
    const keys = calls.map((c) => String(c[1]));
    expect(keys).not.toContain("prospect_identity.genre");
    expect(keys).not.toContain("prospect_identity.tranche_age");
    expect(calls.some((c) => c[0] === "or" && (c[2] as { referencedTable?: string })?.referencedTable)).toBe(false);
  });

  it("applique genre / tranche en SQL et la ville (normalisée) en JS", async () => {
    const { admin, calls } = fakeAdmin([
      row("p1", { ville: "Saint-Étienne", genre: "femme", tranche_age: "18-35" }),
      row("p2", { ville: "Saint-Etienne-de-Tinée", genre: "femme", tranche_age: "18-35" }),
      row("p3", { ville: "saint etienne", genre: "femme", tranche_age: "18-35" }),
      row("p4", { ville: null, genre: "femme", tranche_age: "18-35" }),
    ]);
    const out = await findMatchingProspects(admin, {
      ...baseInput,
      audience: { cities: ["Saint Étienne"], genres: ["femme"], ageBands: ["18-35"] },
    });
    expect(out.map((m) => m.prospectId)).toEqual(["p1", "p3"]);
    expect(calls).toContainEqual(["in", "prospect_identity.genre", ["femme"]]);
    expect(calls).toContainEqual(["in", "prospect_identity.tranche_age", ["18-35"]]);
    const orCall = calls.find(
      (c) => c[0] === "or" && (c[2] as { referencedTable?: string })?.referencedTable === "prospect_identity",
    );
    expect(orCall?.[1]).toMatch(/^ville\.ilike\.[a-z0-9_]+$/);
  });

  it("re-vérifie genre / tranche en JS (défense en profondeur)", async () => {
    const { admin } = fakeAdmin([
      row("p1", { genre: "autre", tranche_age: "35+" }),
      row("p2", { genre: "homme", tranche_age: "35+" }),
    ]);
    const out = await findMatchingProspects(admin, {
      ...baseInput,
      audience: { cities: [], genres: ["femme", "homme"], ageBands: ["35+"] },
    });
    expect(out.map((m) => m.prospectId)).toEqual(["p2"]);
  });
});
