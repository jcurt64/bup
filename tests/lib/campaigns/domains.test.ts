import { describe, expect, it } from "vitest";
import { ACTIVITY_DOMAINS, parseCampaignDomains, pgTextArrayLiteral, readCampaignDomains } from "@/lib/campaigns/domains";
import { CATEGORY_LABELS } from "@/lib/prospect/preferences";

describe("domaines d'activité", () => {
  it("liste partagée pro ↔ prospect", () => {
    expect(CATEGORY_LABELS).toBe(ACTIVITY_DOMAINS);
  });
  it("2 domaines au plus, valeurs inconnues ignorées, [] = Tous", () => {
    expect(parseCampaignDomains(["Auto", "Immobilier", "Finance"])).toEqual(["Auto", "Immobilier"]);
    expect(parseCampaignDomains(["Inconnu", "Auto", "Auto"])).toEqual(["Auto"]);
    expect(parseCampaignDomains(undefined)).toEqual([]);
    expect(readCampaignDomains({ domains: ["Santé"] })).toEqual(["Santé"]);
    expect(readCampaignDomains(null)).toEqual([]);
  });
  it("littéral PostgREST quoté (espaces, &)", () => {
    expect(pgTextArrayLiteral(["Loisirs & voyages", "Auto"])).toBe('{"Loisirs & voyages","Auto"}');
  });
});
