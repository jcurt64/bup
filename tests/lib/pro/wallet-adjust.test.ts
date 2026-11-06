import { describe, it, expect, vi } from "vitest";
import { adjustProWallet } from "@/lib/pro/wallet-adjust";

function fakeAdmin(rpcResult: { error: { code?: string; message: string } | null }, row = { wallet_balance_cents: 1000, wallet_reserved_cents: 200 }) {
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  return {
    rpc: vi.fn(async () => rpcResult),
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: row }) }) }),
      update,
    })),
    update,
  };
}

describe("adjustProWallet", () => {
  it("utilise la RPC atomique (deltas relatifs)", async () => {
    const a = fakeAdmin({ error: null });
    await adjustProWallet(a as never, "pro1", { balanceDelta: 500, reservedDelta: -100 });
    expect(a.rpc).toHaveBeenCalledWith("pro_wallet_adjust", { p_pro: "pro1", p_balance_delta: 500, p_reserved_delta: -100 });
    expect(a.update).not.toHaveBeenCalled();
  });
  it("repli lecture-écriture si la RPC n'existe pas encore (migration non appliquée)", async () => {
    const a = fakeAdmin({ error: { code: "PGRST202", message: "Could not find the function" } });
    await adjustProWallet(a as never, "pro1", { balanceDelta: 500, reservedDelta: -100 });
    expect(a.update).toHaveBeenCalledWith({ wallet_balance_cents: 1500, wallet_reserved_cents: 100 });
  });
  it("propage les autres erreurs", async () => {
    const a = fakeAdmin({ error: { code: "XX000", message: "boom" } });
    await expect(adjustProWallet(a as never, "pro1", { balanceDelta: 1 })).rejects.toThrow("boom");
  });
});
