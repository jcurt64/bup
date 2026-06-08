import { describe, expect, it, vi } from "vitest";
import { distributeFounderBonusIfLaunched } from "@/lib/founder-bonus/distribute";

// Faux client admin : app_config.launch_at fixé + downstream distribute
// (prospects / rpc / admin_broadcasts) espionné.
function makeAdmin(
  launchAt: string | null,
  eligible: {
    id: string;
    clerk_user_id: string | null;
    prospect_identity: { email: string | null; prenom: string | null } | null;
  }[] = [],
) {
  const rpcSpy = vi.fn().mockResolvedValue({ data: true, error: null });
  const insertSpy = vi.fn().mockResolvedValue({ error: null });
  const admin = {
    from: vi.fn((table: string) => {
      if (table === "app_config") {
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: launchAt ? { launch_at: launchAt } : null,
                error: null,
              }),
          }),
        };
      }
      if (table === "prospects") {
        return {
          select: () => ({
            eq: () => ({ eq: () => Promise.resolve({ data: eligible, error: null }) }),
          }),
        };
      }
      if (table === "admin_broadcasts") return { insert: insertSpy };
      throw new Error("table inattendue: " + table);
    }),
    rpc: rpcSpy,
  };
  return { admin, rpcSpy, insertSpy };
}

const FUTURE = "2999-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z";

describe("distributeFounderBonusIfLaunched", () => {
  it("avant le lancement : ne distribue rien", async () => {
    const { admin, rpcSpy } = makeAdmin(FUTURE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonusIfLaunched(admin as any);
    expect(res).toEqual({ ran: false, reason: "before_launch" });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("launch_at indisponible : ne distribue rien", async () => {
    const { admin, rpcSpy } = makeAdmin(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonusIfLaunched(admin as any);
    expect(res.ran).toBe(false);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("après le lancement : déclenche la distribution (0 éligible)", async () => {
    const { admin } = makeAdmin(PAST, []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonusIfLaunched(admin as any);
    expect(res.ran).toBe(true);
    if (res.ran) expect(res.eligible).toBe(0);
  });

  it("après le lancement avec un éligible : crédite via la RPC", async () => {
    const { admin, rpcSpy } = makeAdmin(PAST, [
      { id: "p1", clerk_user_id: "c1", prospect_identity: { email: null, prenom: "Léa" } },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonusIfLaunched(admin as any);
    expect(res.ran).toBe(true);
    expect(rpcSpy).toHaveBeenCalledWith("apply_founder_signup_bonus", {
      p_prospect_id: "p1",
    });
    if (res.ran) expect(res.credited).toBe(1);
  });
});
