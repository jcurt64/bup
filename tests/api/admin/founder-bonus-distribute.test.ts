import { describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/admin/access", () => ({
  requireAdminRequest: (req: Request) => requireAdminMock(req),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({}),
}));
const provisionMock = vi.fn();
vi.mock("@/lib/founder-bonus/sync", () => ({
  provisionFounderBonuses: (...a: unknown[]) => provisionMock(...a),
}));

describe("POST /api/admin/founder-bonus/distribute", () => {
  it("renvoie la réponse de la garde admin si refusée", async () => {
    requireAdminMock.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    const { POST } = await import("@/app/api/admin/founder-bonus/distribute/route");
    const res = await POST(new Request("http://x/api/admin/founder-bonus/distribute", { method: "POST" }));
    expect(res.status).toBe(404);
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it("dry-run par défaut (confirm=false)", async () => {
    requireAdminMock.mockResolvedValueOnce(null);
    provisionMock.mockResolvedValueOnce({ eligible: 7, provisioned: 0, errors: 0 });
    const { POST } = await import("@/app/api/admin/founder-bonus/distribute/route");
    const res = await POST(new Request("http://x/api/admin/founder-bonus/distribute", { method: "POST" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.dryRun).toBe(true);
    expect(json.eligible).toBe(7);
    expect(provisionMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ confirm: false }));
  });

  it("confirm=1 → provisionnement réel", async () => {
    requireAdminMock.mockResolvedValueOnce(null);
    provisionMock.mockResolvedValueOnce({ eligible: 7, provisioned: 7, errors: 0 });
    const { POST } = await import("@/app/api/admin/founder-bonus/distribute/route");
    const res = await POST(new Request("http://x/api/admin/founder-bonus/distribute?confirm=1", { method: "POST" }));
    const json = await res.json();
    expect(json.dryRun).toBe(false);
    expect(json.provisioned).toBe(7);
    expect(provisionMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ confirm: true }));
  });

  it("erreur de la lib → 500 JSON actionnable", async () => {
    requireAdminMock.mockResolvedValueOnce(null);
    provisionMock.mockRejectedValueOnce(new Error("boom"));
    const { POST } = await import("@/app/api/admin/founder-bonus/distribute/route");
    const res = await POST(new Request("http://x/api/admin/founder-bonus/distribute?confirm=1", { method: "POST" }));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.error).toBe("distribute_failed");
  });
});
