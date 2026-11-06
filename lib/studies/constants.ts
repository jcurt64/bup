/**
 * Module « Tests & Études » — constantes partagées (serveur + client).
 * Spec : docs/superpowers/specs/2026-11-06-tests-etudes-design.md
 */

export const STUDY_TYPES = ["survey", "product_test", "visit"] as const;
export type StudyType = (typeof STUDY_TYPES)[number];

export const STUDY_TYPE_LABELS: Record<StudyType, string> = {
  survey: "Sondage en ligne",
  product_test: "Test et avis sur un site ou une appli",
  visit: "Visite en magasin ou rendez-vous d'échange",
};

export const STUDY_SCOPES = ["department", "national"] as const;
export type StudyScope = (typeof STUDY_SCOPES)[number];

export const STUDY_STATUSES = ["draft", "published", "validated", "canceled", "closed"] as const;
export type StudyStatus = (typeof STUDY_STATUSES)[number];

export const PARTICIPATION_STATUSES = [
  "joined", "confirmed", "done", "approved", "rejected", "disputed", "rejected_final", "not_done",
] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

export const REJECT_REASONS = {
  code_missing: "Code non reçu",
  code_invalid: "Code invalide ou déjà utilisé",
  incomplete: "Tâche incomplète",
  fraud: "Participation en double / frauduleuse",
  other: "Autre",
} as const;
export type RejectReason = keyof typeof REJECT_REASONS;

export const REPORT_REASONS = {
  scam: "Arnaque",
  payment: "Demande de paiement",
  personal_data: "Demande de données personnelles",
  forbidden_product: "Produit interdit (santé, cosmétique, compléments, livraison)",
  misleading: "Description trompeuse",
  other: "Autre",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export const PAID_MENTION = "Participation rémunérée via BUUPP";

export const REVIEW_DAYS = 7;
export const DISPUTE_DAYS = 7;
export const LATE_APPROVAL_DAYS = 7;
export const PURGE_DAYS = 30;
export const MIN_REWARD_CENTS = 100;
export const MIN_PARTICIPANTS = 5;
export const MAX_PARTICIPANTS = 500;
export const SIGNUP_MIN_DAYS = 2;
export const SIGNUP_MAX_DAYS = 60;
export const COMPLETION_MIN_DAYS = 3;
export const COMPLETION_MAX_DAYS = 60;
export const REMINDER_HOURS = 48;
export const REPORT_ALERT_THRESHOLD = 3;
export const DONE_COMMENT_MAX = 500;
export const REJECT_NOTE_MAX = 300;
export const DISPUTE_NOTE_MAX = 1000;

export const DAY_MS = 24 * 3600 * 1000;
