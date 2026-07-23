import { describe, expect, it, vi } from "vitest";
import {
  provisionFounderBonuses,
  unlockRipeFounderBonusesAndNotify,
} from "@/lib/founder-bonus/sync";

// Faux client admin : éligibles au provisionnement + lignes débloquées
// renvoyées par la RPC, `admin_broadcasts.insert` espionné.
function makeAdmin(
  eligible: { id: string }[] = [],
  unlocked: {
    prospect_id: string;
    transaction_id: string;
    clerk_user_id: string | null;
    email: string | null;
    prenom: string | null;
  }[] = [],
) {
  const insertSpy = vi.fn().mockResolvedValue({ error: null });
  const rpcSpy = vi.fn((name: string) => {
    if (name === "unlock_ripe_founder_signup_bonuses") {
      return Promise.resolve({ data: unlocked, error: null });
    }
    return Promise.resolve({ data: true, error: null });
  });
  const admin = {
    from: vi.fn((table: string) => {
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
  return { admin, insertSpy, rpcSpy };
}

describe("provisionFounderBonuses", () => {
  it("dry-run : compte les éligibles sans rien écrire", async () => {
    const { admin, rpcSpy } = makeAdmin([{ id: "p1" }, { id: "p2" }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await provisionFounderBonuses(admin as any, { confirm: false });
    expect(res.eligible).toBe(2);
    expect(res.provisioned).toBe(0);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("confirm : provisionne via la RPC, sans notifier", async () => {
    const { admin, rpcSpy, insertSpy } = makeAdmin([{ id: "p1" }, { id: "p2" }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await provisionFounderBonuses(admin as any, { confirm: true });
    expect(res.provisioned).toBe(2);
    expect(rpcSpy).toHaveBeenCalledWith("provision_founder_signup_bonus", {
      p_prospect_id: "p1",
    });
    // Le provisionnement ne notifie pas : la notification a lieu au déblocage.
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("unlockRipeFounderBonusesAndNotify", () => {
  it("aucun bonus mûr : ne notifie rien", async () => {
    const { admin, insertSpy } = makeAdmin([], []);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await unlockRipeFounderBonusesAndNotify(admin as any, { sendEmail });
    expect(res.unlocked).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("un bonus débloqué : une cloche + un email", async () => {
    const { admin } = makeAdmin([], [
      { prospect_id: "p1", transaction_id: "t1", clerk_user_id: "c1", email: "lea@ex.com", prenom: "Léa" },
    ]);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await unlockRipeFounderBonusesAndNotify(admin as any, { sendEmail });
    expect(res.unlocked).toBe(1);
    expect(res.broadcasted).toBe(1);
    expect(res.emailed).toBe(1);
    expect(sendEmail).toHaveBeenCalledWith("lea@ex.com", { prenom: "Léa" });
  });

  it("bénéficiaire sans email ni clerk id : débloqué sans notification", async () => {
    const { admin, insertSpy } = makeAdmin([], [
      { prospect_id: "p2", transaction_id: "t2", clerk_user_id: null, email: null, prenom: null },
    ]);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await unlockRipeFounderBonusesAndNotify(admin as any, { sendEmail });
    expect(res.unlocked).toBe(1);
    expect(res.broadcasted).toBe(0);
    expect(res.emailed).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
