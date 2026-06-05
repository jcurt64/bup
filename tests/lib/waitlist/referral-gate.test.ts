import { describe, expect, it } from "vitest";
import { isReferralOpen } from "@/lib/waitlist/referral";

describe("isReferralOpen", () => {
  it("ouvert par défaut (config absente / null) — fail-open", () => {
    expect(isReferralOpen(null)).toBe(true);
    expect(isReferralOpen(undefined)).toBe(true);
    expect(isReferralOpen({})).toBe(true);
    expect(isReferralOpen({ referrals_enabled: null })).toBe(true);
  });

  it("ouvert quand le flag est true", () => {
    expect(isReferralOpen({ referrals_enabled: true })).toBe(true);
  });

  it("fermé UNIQUEMENT quand le flag est explicitement false", () => {
    expect(isReferralOpen({ referrals_enabled: false })).toBe(false);
  });

  it("n'est plus lié à la date de lancement (launch_at ignoré)", () => {
    // Une config avec une launch_at passée mais sans flag false reste ouverte.
    expect(isReferralOpen({ referrals_enabled: true } as never)).toBe(true);
  });
});
