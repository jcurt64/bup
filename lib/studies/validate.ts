import {
  COMPLETION_MAX_DAYS, COMPLETION_MIN_DAYS, DAY_MS, MAX_PARTICIPANTS, MIN_PARTICIPANTS,
  MIN_REWARD_CENTS, SIGNUP_MAX_DAYS, SIGNUP_MIN_DAYS, STUDY_TYPES,
  type StudyScope, type StudyType,
} from "./constants";
import { isValidDepartment } from "./department";

export type StudyInput = {
  type: StudyType;
  title: string;
  description: string;
  estimatedMinutes: number;
  externalUrl: string | null;
  address: string | null;
  rewardCents: number;
  minParticipants: number;
  maxParticipants: number;
  scope: StudyScope;
  department: string | null;
  signupDeadline: string;
  completionDeadline: string;
};

export type ValidateResult = { ok: true; value: StudyInput } | { ok: false; error: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : NaN);

/** Validation du formulaire de création (bornes du spec §11). */
export function validateStudyInput(raw: unknown, now: Date): ValidateResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const fail = (error: string): ValidateResult => ({ ok: false, error });

  const type = r.type as StudyType;
  if (!STUDY_TYPES.includes(type)) return fail("type_invalid");
  const title = str(r.title);
  if (title.length < 3 || title.length > 120) return fail("title_invalid");
  const description = str(r.description);
  if (description.length < 20 || description.length > 4000) return fail("description_invalid");
  const estimatedMinutes = int(r.estimatedMinutes);
  if (!(estimatedMinutes >= 1 && estimatedMinutes <= 600)) return fail("duration_invalid");

  const urlRaw = str(r.externalUrl);
  let externalUrl: string | null = null;
  if (urlRaw) {
    let u: URL;
    try { u = new URL(urlRaw); } catch { return fail("url_invalid"); }
    if (u.protocol !== "https:") return fail("url_not_https");
    externalUrl = u.toString();
  }
  const address = str(r.address).slice(0, 300) || null;

  const rewardCents = int(r.rewardCents);
  if (!(rewardCents >= MIN_REWARD_CENTS)) return fail("reward_too_low");
  if (rewardCents > 100_000) return fail("reward_too_high");
  const min = int(r.minParticipants);
  const max = int(r.maxParticipants);
  if (!(max <= MAX_PARTICIPANTS)) return fail("max_too_high");
  if (!(min >= MIN_PARTICIPANTS)) return fail("min_too_low");
  if (min > max) return fail("min_gt_max");

  const scope = r.scope as StudyScope;
  if (scope !== "department" && scope !== "national") return fail("scope_invalid");
  if (type === "visit" && scope !== "department") return fail("visit_requires_department");
  let department: string | null = null;
  if (scope === "department") {
    const d = str(r.department).toUpperCase();
    if (!d) return fail("department_required");
    if (!isValidDepartment(d)) return fail("department_invalid");
    department = d;
  }

  const signup = new Date(str(r.signupDeadline)).getTime();
  const completion = new Date(str(r.completionDeadline)).getTime();
  const n = now.getTime();
  if (!Number.isFinite(signup) || signup < n + SIGNUP_MIN_DAYS * DAY_MS || signup > n + SIGNUP_MAX_DAYS * DAY_MS) {
    return fail("signup_deadline_invalid");
  }
  if (
    !Number.isFinite(completion) ||
    completion < signup + COMPLETION_MIN_DAYS * DAY_MS ||
    completion > signup + COMPLETION_MAX_DAYS * DAY_MS
  ) {
    return fail("completion_deadline_invalid");
  }

  return {
    ok: true,
    value: {
      type, title, description, estimatedMinutes, externalUrl, address, rewardCents,
      minParticipants: min, maxParticipants: max, scope, department,
      signupDeadline: new Date(signup).toISOString(),
      completionDeadline: new Date(completion).toISOString(),
    },
  };
}
