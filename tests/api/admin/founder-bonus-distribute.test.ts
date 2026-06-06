import { describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/admin/access", () => ({
  requireAdminRequest: (req: Request) => requireAdminMock(req),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({}),
}));
const distributeMock = vi.fn();
vi.mock("@/lib/founder-bonus/distribute", () => ({
  distributeFounderBonus: (...a: unknown[]) => distributeMock(...a),
}));

describe("POST /api/admin/founder-bonus/distribute", () => {
  it("renvoie la réponse de la garde admin si refusée", async () => {
    requireAdminMock.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    const { POST } = await import("@/app/api/admin/founder-bonus/distribute/route");
    const res = await POST(new Request("http://x/api/admin/founder-bonus/distribute", { method: "POST" }));
    expect(res.status).toBe(404);
    expect(distributeMock).not.toHaveBeenCalled();
  });

  it("dry-run par défaut (confirm=false)", async () => {
    requireAdminMock.mockResolvedValueOnce(null);
    distributeMock.mockResolvedValueOnce({ eligible: 7, credited: 0, broadcasted: 0, emailed: 0, errors: 0 });
    const { POST } = await import("@/app/api/admin/founder-bonus/distribute/route");
    const res = await POST(new Request("http://x/api/admin/founder-bonus/distribute", { method: "POST" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.dryRun).toBe(true);
    expect(json.eligible).toBe(7);
    expect(distributeMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ confirm: false }));
  });

  it("confirm=1 → distribution réelle", async () => {
    requireAdminMock.mockResolvedValueOnce(null);
    distributeMock.mockResolvedValueOnce({ eligible: 7, credited: 7, broadcasted: 7, emailed: 7, errors: 0 });
    const { POST } = await import("@/app/api/admin/founder-bonus/distribute/route");
    const res = await POST(new Request("http://x/api/admin/founder-bonus/distribute?confirm=1", { method: "POST" }));
    const json = await res.json();
    expect(json.dryRun).toBe(false);
    expect(json.credited).toBe(7);
    expect(distributeMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ confirm: true }));
  });
});
