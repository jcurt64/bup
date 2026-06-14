import { describe, it, expect } from "vitest";
import { matchedRelationIds, partitionRecipients, type BroadcastRecipient } from "./broadcast";
import type { SegmentContact } from "./types";

function c(over: Partial<SegmentContact>): SegmentContact {
  return { relationId: "r", score: 700, reached: null, ...over };
}

describe("matchedRelationIds", () => {
  it("ne garde que les contacts correspondant aux filtres", () => {
    const contacts = [
      c({ relationId: "a", score: 800 }),
      c({ relationId: "b", score: 500 }),
      c({ relationId: "c", score: 750 }),
    ];
    expect(matchedRelationIds(contacts, { scoreMin: 720 })).toEqual(["a", "c"]);
  });

  it("filtre par tranche de distance", () => {
    const near = c({ relationId: "n", localisation: { region: null, ville: null, codePostal: null, adresse: null, centerDistanceM: 800 } });
    const far = c({ relationId: "f", localisation: { region: null, ville: null, codePostal: null, adresse: null, centerDistanceM: 9000 } });
    expect(matchedRelationIds([near, far], { distance: ["< 2 km du centre"] })).toEqual(["n"]);
  });
});

describe("partitionRecipients", () => {
  const mk = (over: Partial<BroadcastRecipient>): BroadcastRecipient => ({
    relationId: "r", prospectId: "p", email: "a@b.fr", prenom: null, trackingConsent: false, ...over,
  });

  it("éligible si email présent et quota libre", () => {
    const res = partitionRecipients([mk({ prospectId: "p1" })], new Set());
    expect(res.eligible).toHaveLength(1);
    expect(res.skippedNoEmail).toBe(0);
    expect(res.skippedQuota).toBe(0);
  });

  it("ignore les prospects sans email", () => {
    const res = partitionRecipients([mk({ prospectId: "p1", email: null })], new Set());
    expect(res.eligible).toHaveLength(0);
    expect(res.skippedNoEmail).toBe(1);
  });

  it("ignore les prospects déjà sollicités (quota)", () => {
    const res = partitionRecipients(
      [mk({ prospectId: "p1" }), mk({ prospectId: "p2" })],
      new Set(["p1"]),
    );
    expect(res.eligible.map((r) => r.prospectId)).toEqual(["p2"]);
    expect(res.skippedQuota).toBe(1);
  });
});
