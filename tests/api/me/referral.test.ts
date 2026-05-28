import { describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const currentUserMock = vi.fn();
vi.mock("@/lib/clerk/server", () => ({
  auth: () => authMock(),
  currentUser: () => currentUserMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({}),
}));

const getReferralStatusMock = vi.fn();
vi.mock("@/lib/waitlist/referral", () => ({
  getReferralStatus: (...args: unknown[]) => getReferralStatusMock(...args),
}));

describe("GET /api/me/referral", () => {
  it("renvoie 401 sans session Clerk", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const { GET } = await import("@/app/api/me/referral/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("renvoie badgeTier:null si pas d'e-mail primaire", async () => {
    authMock.mockResolvedValueOnce({ userId: "u1" });
    currentUserMock.mockResolvedValueOnce({ emailAddresses: [], primaryEmailAddressId: null });
    const { GET } = await import("@/app/api/me/referral/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.badgeTier).toBeNull();
    expect(json.founderNumber).toBeNull();
  });

  it("délègue à getReferralStatus et renvoie ses champs", async () => {
    authMock.mockResolvedValueOnce({ userId: "u1" });
    currentUserMock.mockResolvedValueOnce({
      emailAddresses: [{ id: "e1", emailAddress: "a@b.com" }],
      primaryEmailAddressId: "e1",
    });
    getReferralStatusMock.mockResolvedValueOnce({
      refCode: "ABC1234",
      count: 5,
      cap: 10,
      remaining: 5,
      badgeTier: "argent",
      founderNumber: 23,
      isFounder: true,
    });
    const { GET } = await import("@/app/api/me/referral/route");
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({
      refCode: "ABC1234",
      count: 5,
      cap: 10,
      remaining: 5,
      badgeTier: "argent",
      founderNumber: 23,
      isFounder: true,
    });
  });
});
