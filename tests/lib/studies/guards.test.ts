import { describe, it, expect } from "vitest";
import { canWithdraw, canMarkDone, canDispute, canProApprove, canProReject } from "@/lib/studies/status";
import { signUnsubscribe, verifyUnsubscribe } from "@/lib/studies/unsubscribe";

const D = 864e5;
const T = new Date("2026-12-10T00:00:00Z").getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const c = (status: string) => ({ status, signup_deadline: iso(T - 5 * D), completion_deadline: iso(T) });

describe("gardes participation", () => {
  it("retrait seulement si publiée et joined", () => {
    expect(canWithdraw(c("published"), { status: "joined" })).toBe(true);
    expect(canWithdraw(c("validated"), { status: "confirmed" })).toBe(false);
  });
  it("terminé avant la date limite seulement", () => {
    expect(canMarkDone(c("validated"), { status: "confirmed" }, new Date(T - 1))).toBe(true);
    expect(canMarkDone(c("validated"), { status: "confirmed" }, new Date(T))).toBe(false);
    expect(canMarkDone(c("published"), { status: "joined" }, new Date(T - D))).toBe(false);
  });
  it("contestation sous 7 j", () => {
    expect(canDispute({ status: "rejected", rejected_at: iso(T) }, new Date(T + 7 * D - 1))).toBe(true);
    expect(canDispute({ status: "rejected", rejected_at: iso(T) }, new Date(T + 7 * D))).toBe(false);
    expect(canDispute({ status: "done", rejected_at: null }, new Date(T))).toBe(false);
  });
  it("approbation pro tardive jusqu'à fin + 7 j (oubli du clic en magasin)", () => {
    expect(canProApprove(c("validated"), { status: "not_done" }, new Date(T + 7 * D - 1))).toBe(true);
    expect(canProApprove(c("validated"), { status: "not_done" }, new Date(T + 7 * D))).toBe(false);
    expect(canProApprove(c("validated"), { status: "done" }, new Date(T + 30 * D))).toBe(true);
    expect(canProApprove(c("validated"), { status: "approved" }, new Date(T))).toBe(false);
  });
  it("refus pro : done et avant l'échéance de revue", () => {
    expect(canProReject(c("validated"), { status: "done", review_due_at: iso(T + D) }, new Date(T))).toBe(true);
    expect(canProReject(c("validated"), { status: "done", review_due_at: iso(T + D) }, new Date(T + D))).toBe(false);
    expect(canProReject(c("validated"), { status: "confirmed", review_due_at: null }, new Date(T))).toBe(false);
  });
});

describe("lien de désabonnement signé", () => {
  it("round-trip et refus d'une signature altérée", () => {
    process.env.STUDIES_UNSUB_SECRET = "x".repeat(40);
    const tok = signUnsubscribe("11111111-1111-1111-1111-111111111111");
    expect(verifyUnsubscribe(tok)).toBe("11111111-1111-1111-1111-111111111111");
    expect(verifyUnsubscribe(tok.slice(0, -2) + "zz")).toBeNull();
    expect(verifyUnsubscribe("garbage")).toBeNull();
  });
});
