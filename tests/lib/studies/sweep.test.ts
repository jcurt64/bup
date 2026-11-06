import { describe, it, expect } from "vitest";
import { planTransitions, type SweepCampaign, type SweepParticipation } from "@/lib/studies/plan";

const D = 864e5;
const T0 = new Date("2026-12-01T00:00:00Z").getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const camp = (o: Partial<SweepCampaign> = {}): SweepCampaign => ({
  id: "c", status: "published", min_participants: 2, max_participants: 10,
  signup_deadline: iso(T0), completion_deadline: iso(T0 + 10 * D),
  closed_at: null, purged_at: null, canceled_at: null, budget_reserved_cents: 1000, ...o,
});
const part = (id: string, status: string, o: Partial<SweepParticipation> = {}): SweepParticipation =>
  ({ id, status, review_due_at: null, rejected_at: null, ...o });
const kinds = (ts: { kind: string; id: string }[]) => ts.map((t) => `${t.kind}:${t.id}`);

describe("planTransitions", () => {
  it("rien avant la date limite d'inscription", () => {
    expect(planTransitions(camp(), [part("a", "joined")], new Date(T0 - 1))).toEqual([]);
  });
  it("seuil atteint → validate", () => {
    expect(kinds(planTransitions(camp(), [part("a", "joined"), part("b", "joined")], new Date(T0)))).toEqual(["validate:c"]);
  });
  it("seuil non atteint → cancel", () => {
    expect(kinds(planTransitions(camp(), [part("a", "joined")], new Date(T0)))).toEqual(["cancel:c"]);
  });
  it("validée : confirmed après la date limite de réalisation → not_done", () => {
    const c = camp({ status: "validated" });
    expect(kinds(planTransitions(c, [part("a", "confirmed")], new Date(T0 + 10 * D)))).toEqual(["not_done:a"]);
  });
  it("done après 7 j → auto_approve", () => {
    const c = camp({ status: "validated" });
    const p = part("a", "done", { review_due_at: iso(T0 + 5 * D) });
    expect(kinds(planTransitions(c, [p], new Date(T0 + 5 * D - 1)))).toEqual([]);
    expect(kinds(planTransitions(c, [p], new Date(T0 + 5 * D)))).toEqual(["auto_approve:a"]);
  });
  it("refus non contesté après 7 j → reject_final", () => {
    const c = camp({ status: "validated" });
    const p = part("a", "rejected", { rejected_at: iso(T0 + 2 * D) });
    expect(kinds(planTransitions(c, [p], new Date(T0 + 9 * D)))).toEqual(["reject_final:a"]);
  });
  it("disputed bloque la clôture", () => {
    const c = camp({ status: "validated" });
    expect(kinds(planTransitions(c, [part("a", "disputed")], new Date(T0 + 30 * D)))).toEqual([]);
  });
  it("clôture à fin de réalisation + 7 j quand plus rien n'est ouvert (y compris après transitions du tour)", () => {
    const c = camp({ status: "validated" });
    const ps = [part("a", "approved"), part("b", "confirmed"), part("c2", "done", { review_due_at: iso(T0 + 9 * D) })];
    expect(kinds(planTransitions(c, ps, new Date(T0 + 17 * D - 1)))).toEqual(["not_done:b", "auto_approve:c2"]);
    expect(kinds(planTransitions(c, ps, new Date(T0 + 17 * D)))).toEqual(["not_done:b", "auto_approve:c2", "close:c"]);
  });
  it("annulée avec réservation résiduelle et plus rien en attente → close (libération)", () => {
    const c = camp({ status: "canceled", budget_reserved_cents: 230 });
    expect(kinds(planTransitions(c, [part("a", "approved")], new Date(T0)))).toEqual(["close:c"]);
    expect(kinds(planTransitions(camp({ status: "canceled", budget_reserved_cents: 0 }), [], new Date(T0)))).toEqual([]);
  });
  it("purge 30 j après clôture, une seule fois", () => {
    const c = camp({ status: "closed", closed_at: iso(T0) });
    expect(kinds(planTransitions(c, [], new Date(T0 + 30 * D)))).toEqual(["purge:c"]);
    expect(planTransitions({ ...c, purged_at: iso(T0 + 30 * D) }, [], new Date(T0 + 31 * D))).toEqual([]);
  });

  it("campagne suspendue : pas d'auto-validation ni de refus définitif automatique (arbitrage admin)", () => {
    const c = camp({ status: "canceled", budget_reserved_cents: 460 });
    const ps = [part("a", "done", { review_due_at: iso(T0) }), part("b", "rejected", { rejected_at: iso(T0) })];
    expect(planTransitions(c, ps, new Date(T0 + 30 * D))).toEqual([]);
  });
  it("campagne annulée : purge 30 j après l'annulation quand plus rien n'est en attente", () => {
    const c = camp({ status: "canceled", budget_reserved_cents: 0, canceled_at: iso(T0) });
    expect(kinds(planTransitions(c, [part("a", "approved")], new Date(T0 + 30 * D)))).toEqual(["purge:c"]);
    expect(planTransitions(c, [part("a", "approved")], new Date(T0 + 29 * D))).toEqual([]);
    expect(planTransitions({ ...c, purged_at: iso(T0) }, [], new Date(T0 + 40 * D))).toEqual([]);
  });
});
