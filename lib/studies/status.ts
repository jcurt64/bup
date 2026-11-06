import type { ParticipationStatus, StudyStatus } from "./constants";
import { DAY_MS, DISPUTE_DAYS, LATE_APPROVAL_DAYS } from "./constants";

export type StudyBadgeKey = "open" | "remaining" | "validated" | "full" | "canceled" | "closed" | "draft";

export function studyBadge(c: {
  status: StudyStatus | string;
  joinedCount: number;
  min: number;
  max: number;
}): { key: StudyBadgeKey; label: string } {
  if (c.status === "draft") return { key: "draft", label: "Brouillon" };
  if (c.status === "canceled") return { key: "canceled", label: "Annulée" };
  if (c.status === "closed") return { key: "closed", label: "Clôturée" };
  if (c.joinedCount >= c.max) return { key: "full", label: "Complète" };
  if (c.status === "validated") return { key: "validated", label: "Validée" };
  const remaining = c.min - c.joinedCount;
  if (remaining > 0) {
    return { key: "remaining", label: `Plus que ${remaining} participant${remaining > 1 ? "s" : ""}` };
  }
  return { key: "open", label: "Inscriptions ouvertes" };
}

type Camp = { status: string; signup_deadline: string; completion_deadline: string };
type Part = { status: ParticipationStatus | string; rejected_at?: string | null };
const t = (s: string | null | undefined) => (s ? new Date(s).getTime() : NaN);

/** Le prospect peut se retirer tant que la campagne n'est pas validée. */
export function canWithdraw(c: Camp, p: Part): boolean {
  return c.status === "published" && p.status === "joined";
}

/** « J'ai terminé » : campagne validée, participation confirmée, avant la date limite. */
export function canMarkDone(c: Camp, p: Part, now: Date): boolean {
  return c.status === "validated" && p.status === "confirmed" && now.getTime() < t(c.completion_deadline);
}

/** Contestation d'un refus sous 7 jours. */
export function canDispute(p: Part, now: Date): boolean {
  return p.status === "rejected" && now.getTime() < t(p.rejected_at) + DISPUTE_DAYS * DAY_MS;
}

/** Approbation par le pro : y compris tardive (confirmed/not_done) jusqu'à fin de réalisation + 7 j. */
export function canProApprove(c: Camp, p: Part, now: Date): boolean {
  if (c.status !== "validated") return false;
  if (p.status === "done") return true;
  if (p.status === "confirmed" || p.status === "not_done") {
    return now.getTime() < t(c.completion_deadline) + LATE_APPROVAL_DAYS * DAY_MS;
  }
  return false;
}

/** Refus par le pro : participation déclarée faite et pas encore auto-validée. */
export function canProReject(c: Camp, p: Part & { review_due_at?: string | null }, now: Date): boolean {
  return c.status === "validated" && p.status === "done" && now.getTime() < t(p.review_due_at);
}
