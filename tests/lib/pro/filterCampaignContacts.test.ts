import { describe, it, expect } from "vitest";
import {
  filterCampaignContacts,
  type CampaignContact,
} from "@/lib/pro/filterCampaignContacts";

function c(over: Partial<CampaignContact>): CampaignContact {
  return {
    id: "r1",
    prospectId: "p1",
    name: "Alice",
    score: 700,
    tierLabel: "P1 · Identification",
    decidedAt: new Date().toISOString(),
    statusLabel: "Crédité",
    statusChip: "good",
    status: "settled",
    ...over,
  };
}

describe("filterCampaignContacts", () => {
  it("status=all garde accepted + settled", () => {
    const list = [c({ status: "accepted" }), c({ status: "settled" })];
    const out = filterCampaignContacts(list, {
      status: "all",
      scoreMin: null,
      period: "all",
    });
    expect(out).toHaveLength(2);
  });

  it("status=accepted ne garde que accepted", () => {
    const list = [c({ status: "accepted" }), c({ status: "settled" })];
    const out = filterCampaignContacts(list, {
      status: "accepted",
      scoreMin: null,
      period: "all",
    });
    expect(out.map((x) => x.status)).toEqual(["accepted"]);
  });

  it("status=settled ne garde que settled", () => {
    const list = [c({ status: "accepted" }), c({ status: "settled" })];
    const out = filterCampaignContacts(list, {
      status: "settled",
      scoreMin: null,
      period: "all",
    });
    expect(out.map((x) => x.status)).toEqual(["settled"]);
  });

  it("scoreMin exclut les scores inférieurs et les scores null", () => {
    const list = [
      c({ id: "a", score: 800 }),
      c({ id: "b", score: 500 }),
      c({ id: "z", score: null }),
    ];
    const out = filterCampaignContacts(list, {
      status: "all",
      scoreMin: 600,
      period: "all",
    });
    expect(out.map((x) => x.id)).toEqual(["a"]);
  });

  it("period=7d exclut les contacts plus vieux que 7 jours", () => {
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const old = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const list = [
      c({ id: "new", decidedAt: recent }),
      c({ id: "old", decidedAt: old }),
    ];
    const out = filterCampaignContacts(list, {
      status: "all",
      scoreMin: null,
      period: "7d",
    });
    expect(out.map((x) => x.id)).toEqual(["new"]);
  });

  it("combine les trois filtres", () => {
    const recent = new Date(Date.now() - 1 * 86_400_000).toISOString();
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const list = [
      c({ id: "keep", status: "settled", score: 900, decidedAt: recent }),
      c({ id: "badStatus", status: "accepted", score: 900, decidedAt: recent }),
      c({ id: "badScore", status: "settled", score: 100, decidedAt: recent }),
      c({ id: "badDate", status: "settled", score: 900, decidedAt: old }),
    ];
    const out = filterCampaignContacts(list, {
      status: "settled",
      scoreMin: 500,
      period: "30d",
    });
    expect(out.map((x) => x.id)).toEqual(["keep"]);
  });

  it("liste vide → []", () => {
    expect(
      filterCampaignContacts([], { status: "all", scoreMin: null, period: "all" }),
    ).toEqual([]);
  });
});
