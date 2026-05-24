import { describe, expect, it, vi } from "vitest";

// Mock Clerk + Supabase au niveau module.
const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    from: vi.fn().mockReturnValue({ upsert: upsertSpy }),
  }),
}));

describe("POST /api/me/push-token", () => {
  it("renvoie 401 sans session Clerk", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const { POST } = await import("@/app/api/me/push-token/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          token: "ExponentPushToken[abcdefghij]",
          platform: "ios",
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("renvoie 400 si token mal formé", async () => {
    authMock.mockResolvedValueOnce({ userId: "u1" });
    const { POST } = await import("@/app/api/me/push-token/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ token: "nope", platform: "ios" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("upsert le token avec user_id et renvoie 200", async () => {
    authMock.mockResolvedValueOnce({ userId: "u-clerk" });
    upsertSpy.mockClear();
    const { POST } = await import("@/app/api/me/push-token/route");
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          token: "ExponentPushToken[abcdefghij]",
          platform: "ios",
          appVersion: "1.0.0",
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u-clerk",
        expo_token: "ExponentPushToken[abcdefghij]",
        platform: "ios",
        app_version: "1.0.0",
      }),
      expect.objectContaining({ onConflict: "expo_token" }),
    );
  });
});
