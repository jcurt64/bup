/**
 * Planification pure des transitions d'échéance d'une campagne Tests & Études.
 * Exécutée par `lib/studies/sweep.ts` (RPC idempotentes) à chaque lecture et
 * une fois par jour (cron digest). Spec §9.
 */
import { DAY_MS, DISPUTE_DAYS, LATE_APPROVAL_DAYS, PURGE_DAYS } from "./constants";

export type SweepCampaign = {
  id: string;
  status: string;
  min_participants: number;
  max_participants: number;
  signup_deadline: string;
  completion_deadline: string;
  closed_at: string | null;
  canceled_at?: string | null;
  purged_at: string | null;
  budget_reserved_cents: number;
};
export type SweepParticipation = {
  id: string;
  status: string;
  review_due_at: string | null;
  rejected_at: string | null;
};
export type TransitionKind =
  | "validate" | "cancel" | "not_done" | "auto_approve" | "reject_final" | "close" | "purge";
export type Transition = { kind: TransitionKind; id: string };

const PENDING = new Set(["confirmed", "done", "rejected", "disputed"]);
const ms = (s: string | null) => (s ? new Date(s).getTime() : NaN);

export function planTransitions(c: SweepCampaign, parts: SweepParticipation[], now: Date): Transition[] {
  const n = now.getTime();
  const out: Transition[] = [];

  if (c.status === "published") {
    if (n >= ms(c.signup_deadline)) {
      const joined = parts.filter((p) => p.status === "joined").length;
      out.push({ kind: joined >= c.min_participants ? "validate" : "cancel", id: c.id });
    }
    return out;
  }

  if (c.status === "closed") {
    if (!c.purged_at && c.closed_at && n >= ms(c.closed_at) + PURGE_DAYS * DAY_MS) {
      out.push({ kind: "purge", id: c.id });
    }
    return out;
  }

  if (c.status !== "validated" && c.status !== "canceled") return out;

  // Statut de chaque participation après les transitions de ce tour.
  // Campagne suspendue (annulée après validation) : les participations
  // conservées attendent l'arbitrage admin — aucune transition automatique.
  const auto = c.status === "validated";
  const after = parts.map((p) => {
    if (!auto) return p.status;
    if (p.status === "confirmed" && n >= ms(c.completion_deadline)) {
      out.push({ kind: "not_done", id: p.id });
      return "not_done";
    }
    if (p.status === "done" && n >= ms(p.review_due_at)) {
      out.push({ kind: "auto_approve", id: p.id });
      return "approved";
    }
    if (p.status === "rejected" && n >= ms(p.rejected_at) + DISPUTE_DAYS * DAY_MS) {
      out.push({ kind: "reject_final", id: p.id });
      return "rejected_final";
    }
    return p.status;
  });
  const nothingPending = after.every((s) => !PENDING.has(s));

  if (c.status === "validated") {
    if (nothingPending && n >= ms(c.completion_deadline) + LATE_APPROVAL_DAYS * DAY_MS) {
      out.push({ kind: "close", id: c.id });
    }
  } else if (nothingPending && c.budget_reserved_cents > 0) {
    out.push({ kind: "close", id: c.id });
  } else if (
    nothingPending && !c.purged_at && c.canceled_at &&
    n >= ms(c.canceled_at) + PURGE_DAYS * DAY_MS
  ) {
    out.push({ kind: "purge", id: c.id });
  }
  return out;
}
