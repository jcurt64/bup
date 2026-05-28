import { describe, expect, it } from "vitest";
import { referralBadgeTier, getReferralStatus, isGoldFounder } from "@/lib/waitlist/referral";

// Faux client Supabase admin paramétrable. getReferralStatus fait 3 appels
// distincts à .from("waitlist") :
//   1. .select("ref_code, created_at").ilike("email").maybeSingle()  → row user
//   2. .select("id", {count,head}).eq("referrer_ref_code")           → nb filleuls
//   3. .select("id", {count,head}).lte("created_at")                 → rang
// On distingue (1) des (2)/(3) via la présence du modifier `count`, puis
// .eq → filleulCount et .lte → rankCount.
function makeAdmin(opts: {
  waitlistRow?: { ref_code: string; created_at: string } | null;
  filleulCount?: number;
  rankCount?: number;
}) {
  const select = (_cols: string, modifiers?: { count?: string; head?: boolean }) => {
    if (!modifiers?.count) {
      return {
        ilike: () => ({
          maybeSingle: async () => ({ data: opts.waitlistRow ?? null, error: null }),
        }),
      };
    }
    return {
      eq: async () => ({ count: opts.filleulCount ?? 0, error: null }),
      lte: async () => ({ count: opts.rankCount ?? 0, error: null }),
    };
  };
  return {
    from(table: string) {
      if (table !== "waitlist") throw new Error("table inattendue: " + table);
      return { select };
    },
  } as any;
}

describe("referralBadgeTier", () => {
  it("renvoie null à 0 filleul", () => {
    expect(referralBadgeTier(0)).toBeNull();
  });
  it("renvoie cuivre pour 1-2 filleuls", () => {
    expect(referralBadgeTier(1)).toBe("cuivre");
    expect(referralBadgeTier(2)).toBe("cuivre");
  });
  it("renvoie argent pour 3-9 filleuls", () => {
    expect(referralBadgeTier(3)).toBe("argent");
    expect(referralBadgeTier(9)).toBe("argent");
  });
  it("renvoie or à partir de 10 filleuls", () => {
    expect(referralBadgeTier(10)).toBe("or");
    expect(referralBadgeTier(11)).toBe("or");
  });
});

describe("getReferralStatus", () => {
  it("membre waitlist avec 5 filleuls, rang 23", async () => {
    const admin = makeAdmin({
      waitlistRow: { ref_code: "ABC1234", created_at: "2026-05-01T00:00:00Z" },
      filleulCount: 5,
      rankCount: 23,
    });
    const s = await getReferralStatus(admin, "a@b.com");
    expect(s.refCode).toBe("ABC1234");
    expect(s.count).toBe(5);
    expect(s.badgeTier).toBe("argent");
    expect(s.founderNumber).toBe(23);
    expect(s.isFounder).toBe(true);
    expect(s.cap).toBe(10);
    expect(s.remaining).toBe(5);
  });

  it("non inscrit waitlist → pas de badge, founderNumber null", async () => {
    const admin = makeAdmin({ waitlistRow: null });
    const s = await getReferralStatus(admin, "x@y.com");
    expect(s.isFounder).toBe(false);
    expect(s.founderNumber).toBeNull();
    expect(s.count).toBe(0);
    expect(s.badgeTier).toBeNull();
    expect(s.refCode).toMatch(/^[0-9A-Z]{7}$/); // dérivé de l'email
  });
});

describe("isGoldFounder", () => {
  it("true à 10 filleuls", async () => {
    const admin = makeAdmin({ waitlistRow: { ref_code: "ABC1234", created_at: "2026-05-01T00:00:00Z" }, filleulCount: 10 });
    expect(await isGoldFounder(admin, "a@b.com")).toBe(true);
  });
  it("false à 9 filleuls", async () => {
    const admin = makeAdmin({ waitlistRow: { ref_code: "ABC1234", created_at: "2026-05-01T00:00:00Z" }, filleulCount: 9 });
    expect(await isGoldFounder(admin, "a@b.com")).toBe(false);
  });
  it("false si email null", async () => {
    const admin = makeAdmin({});
    expect(await isGoldFounder(admin, null)).toBe(false);
  });
});
