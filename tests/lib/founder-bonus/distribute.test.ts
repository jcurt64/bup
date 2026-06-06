import { describe, expect, it, vi } from "vitest";
import { distributeFounderBonus } from "@/lib/founder-bonus/distribute";

// Faux client admin Supabase : éligibles fixés, rpc + insert espionnés.
function makeAdmin(rows: { id: string; clerk_user_id: string | null; prenom: string | null; email: string | null }[]) {
  const insertSpy = vi.fn().mockResolvedValue({ error: null });
  const rpcSpy = vi.fn().mockResolvedValue({ data: true, error: null });
  const eligibleRows = rows.map((r) => ({
    id: r.id,
    clerk_user_id: r.clerk_user_id,
    prospect_identity: { email: r.email, prenom: r.prenom },
  }));
  const admin = {
    from: vi.fn((table: string) => {
      if (table === "prospects") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: eligibleRows, error: null }),
            }),
          }),
        };
      }
      if (table === "admin_broadcasts") {
        return { insert: insertSpy };
      }
      throw new Error("table inattendue: " + table);
    }),
    rpc: rpcSpy,
  };
  return { admin, insertSpy, rpcSpy };
}

const sample = [
  { id: "p1", clerk_user_id: "c1", prenom: "Léa", email: "lea@ex.com" },
  { id: "p2", clerk_user_id: "c2", prenom: "Tom", email: "tom@ex.com" },
];

describe("distributeFounderBonus", () => {
  it("dry-run : compte les éligibles sans rien écrire", async () => {
    const { admin, insertSpy, rpcSpy } = makeAdmin(sample);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonus(admin as any, { confirm: false, sendEmail });
    expect(res.eligible).toBe(2);
    expect(res.credited).toBe(0);
    expect(rpcSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("confirm : crédite + broadcast + email par bénéficiaire", async () => {
    const { admin, insertSpy, rpcSpy } = makeAdmin(sample);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonus(admin as any, { confirm: true, sendEmail });
    expect(res.eligible).toBe(2);
    expect(res.credited).toBe(2);
    expect(res.emailed).toBe(2);
    expect(rpcSpy).toHaveBeenCalledTimes(2);
    expect(rpcSpy).toHaveBeenCalledWith("apply_founder_signup_bonus", { p_prospect_id: "p1" });
    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledWith("lea@ex.com", { prenom: "Léa" });
  });

  it("confirm : RPC renvoyant false (déjà crédité) → pas de broadcast/email", async () => {
    const { admin, insertSpy, rpcSpy } = makeAdmin(sample);
    rpcSpy.mockResolvedValue({ data: false, error: null });
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonus(admin as any, { confirm: true, sendEmail });
    expect(res.credited).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("confirm : broadcast en échec n'empêche pas l'email + compte une erreur", async () => {
    const { admin, insertSpy, rpcSpy } = makeAdmin([sample[0]]);
    rpcSpy.mockResolvedValue({ data: true, error: null });
    insertSpy.mockResolvedValueOnce({ error: { message: "db down" } });
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonus(admin as any, { confirm: true, sendEmail });
    expect(res.credited).toBe(1);
    expect(res.broadcasted).toBe(0);
    expect(res.emailed).toBe(1);
    expect(res.errors).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("confirm : clerk_user_id null → broadcast ignoré, email envoyé", async () => {
    const { admin, insertSpy } = makeAdmin([
      { id: "p1", clerk_user_id: null, prenom: "Léa", email: "lea@ex.com" },
    ]);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonus(admin as any, { confirm: true, sendEmail });
    expect(res.credited).toBe(1);
    expect(res.broadcasted).toBe(0);
    expect(res.emailed).toBe(1);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("confirm : email null → email ignoré, broadcast envoyé", async () => {
    const { admin, insertSpy } = makeAdmin([
      { id: "p1", clerk_user_id: "c1", prenom: "Léa", email: null },
    ]);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonus(admin as any, { confirm: true, sendEmail });
    expect(res.credited).toBe(1);
    expect(res.broadcasted).toBe(1);
    expect(res.emailed).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});
