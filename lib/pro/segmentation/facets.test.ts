import { describe, it, expect } from "vitest";
import { buildFacets } from "./facets";
import type { SegmentContact, TierKey } from "./types";

function c(over: Partial<SegmentContact>): SegmentContact {
  return { relationId: Math.random().toString(), score: 700, reached: null, ...over };
}

describe("buildFacets", () => {
  it("buckets scores into <600 / 600-719 / ≥720", () => {
    const f = buildFacets(
      [c({ score: 500 }), c({ score: 650 }), c({ score: 720 }), c({ score: 800 })],
      [],
    );
    expect(f.total).toBe(4);
    expect(f.score).toEqual([
      { label: "< 600", count: 1 },
      { label: "600 – 719", count: 1 },
      { label: "≥ 720", count: 2 },
    ]);
  });

  it("counts reached status including 'Non évalué'", () => {
    const f = buildFacets([c({ reached: "atteint" }), c({ reached: "non_atteint" }), c({ reached: null })], []);
    expect(f.reached).toEqual(
      expect.arrayContaining([
        { value: "Atteint", count: 1 },
        { value: "Non atteint", count: 1 },
        { value: "Non évalué", count: 1 },
      ]),
    );
  });

  it("includes a categorical facet only when its tier is allowed", () => {
    const contacts = [c({ pro: { poste: null, statut: "Salarié", secteur: null, revenus: null } })];
    expect(buildFacets(contacts, [])["statutPro"]).toBeUndefined();
    expect(buildFacets(contacts, ["pro"] as TierKey[])["statutPro"]).toEqual([{ value: "Salarié", count: 1 }]);
  });

  it("sorts categories by count desc and ignores null/empty values", () => {
    const mk = (region: string | null) => c({ localisation: { region, ville: null, codePostal: null, adresse: null, centerDistanceM: null } });
    const f = buildFacets([mk("Rhône"), mk("Rhône"), mk("Paris"), mk(null), mk("  ")], ["localisation"] as TierKey[]);
    expect(f["region"]).toEqual([
      { value: "Rhône", count: 2 },
      { value: "Paris", count: 1 },
    ]);
  });

  it("construit la facette distance (tranches ordonnées proche → lointain)", () => {
    const mk = (m: number | null) =>
      c({ localisation: { region: null, ville: null, codePostal: null, adresse: null, centerDistanceM: m } });
    const f = buildFacets(
      [mk(7000), mk(800), mk(800), mk(40000), mk(null)],
      ["localisation"] as TierKey[],
    );
    expect(f["distance"]).toEqual([
      { value: "< 2 km du centre", count: 2 },
      { value: "5–10 km du centre", count: 1 },
      { value: "> 20 km du centre", count: 1 },
    ]);
  });

  it("collapses categories beyond the top 12 into 'Autres'", () => {
    const contacts: SegmentContact[] = [];
    for (let i = 0; i < 15; i++) contacts.push(c({ localisation: { region: `R${i}`, ville: null, codePostal: null, adresse: null, centerDistanceM: null } }));
    const region = buildFacets(contacts, ["localisation"] as TierKey[])["region"]!;
    expect(region).toHaveLength(13); // 12 + "Autres"
    expect(region[12]).toEqual({ value: "Autres", count: 3 });
  });
});
