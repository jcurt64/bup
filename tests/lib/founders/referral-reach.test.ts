import { describe, it, expect } from "vitest";
import { computeReferralReach } from "@/lib/founders/referral-reach";

// Mock supabase admin : 3 requêtes (waitlist parrains, waitlist filleuls,
// prospect_identity). On distingue les deux requêtes waitlist par le select.
function makeAdmin(responses: {
  wlParrains: { email: string; ref_code: string | null }[];
  wlFilleuls: { email: string; referrer_ref_code: string | null }[];
  idents: {
    email: string;
    prenom: string | null;
    prospect_id: string | null;
    prospects: { verification: string; clerk_user_id: string | null } | null;
  }[];
}) {
  return {
    from(table: string) {
      return {
        select(sel: string) {
          return {
            in(_col: string, _vals: string[]) {
              if (table === "waitlist") {
                const isFilleulQuery = sel.includes("referrer_ref_code");
                return Promise.resolve({
                  data: isFilleulQuery ? responses.wlFilleuls : responses.wlParrains,
                });
              }
              if (table === "prospect_identity") {
                return Promise.resolve({ data: responses.idents });
              }
              return Promise.resolve({ data: [] });
            },
          };
        },
      };
    },
  } as never;
}

describe("computeReferralReach", () => {
  const responses = {
    wlParrains: [{ email: "p@x.com", ref_code: "CODEP" }],
    wlFilleuls: [
      { email: "f1@x.com", referrer_ref_code: "CODEP" },
      { email: "f2@x.com", referrer_ref_code: "CODEP" },
      { email: "already@x.com", referrer_ref_code: "CODEP" }, // déjà ciblé
    ],
    idents: [
      { email: "f1@x.com", prenom: "F1", prospect_id: "F1", prospects: { verification: "basique", clerk_user_id: "c1" } },
      { email: "f2@x.com", prenom: "F2", prospect_id: "F2", prospects: { verification: "certifie_confiance", clerk_user_id: "c2" } },
      { email: "already@x.com", prenom: "A", prospect_id: "ALR", prospects: { verification: "basique", clerk_user_id: "c3" } },
    ],
  };
  // P (parrain ciblé) + ALR (filleul DÉJÀ ciblé → doit être dédupliqué).
  const matched = [
    { prospectId: "P", email: "p@x.com" },
    { prospectId: "ALR", email: "already@x.com" },
  ];

  it("ajoute les filleuls non ciblés et flag le parrain", async () => {
    const admin = makeAdmin(responses);
    const { filleuls, parrainProspectIds } = await computeReferralReach(admin, { matched, maxExtra: 10 });
    expect(filleuls.map((f) => f.prospectId).sort()).toEqual(["F1", "F2"]);
    // ALR exclu (déjà ciblé).
    expect(filleuls.some((f) => f.prospectId === "ALR")).toBe(false);
    expect(parrainProspectIds).toEqual(["P"]);
    expect(filleuls.find((f) => f.prospectId === "F2")?.verification).toBe("certifie_confiance");
  });

  it("respecte le plafond maxExtra", async () => {
    const admin = makeAdmin(responses);
    const { filleuls } = await computeReferralReach(admin, { matched, maxExtra: 1 });
    expect(filleuls).toHaveLength(1);
  });

  it("ne fait rien sans parrain en waitlist", async () => {
    const admin = makeAdmin({ ...responses, wlParrains: [] });
    const { filleuls, parrainProspectIds } = await computeReferralReach(admin, { matched, maxExtra: 10 });
    expect(filleuls).toHaveLength(0);
    expect(parrainProspectIds).toHaveLength(0);
  });
});
