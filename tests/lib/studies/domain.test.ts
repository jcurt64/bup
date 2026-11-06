import { describe, it, expect } from "vitest";
import { validateStudyInput } from "@/lib/studies/validate";
import { studyBudgetMaxCents, studyUnitCostCents } from "@/lib/studies/budget";
import { departmentFromPostalCode } from "@/lib/studies/department";
import { studyBadge } from "@/lib/studies/status";
import { generateParticipationCode } from "@/lib/studies/codes";
import { toProParticipant } from "@/lib/studies/mappers";

const NOW = new Date("2026-11-07T10:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 864e5).toISOString();
const base = {
  type: "survey", title: "Avis sur notre appli", description: "Répondez à 10 questions sur notre nouvelle appli de réservation.",
  estimatedMinutes: 10, externalUrl: "https://example.com/sondage", address: null,
  rewardCents: 200, minParticipants: 50, maxParticipants: 200, scope: "national", department: null,
  signupDeadline: days(10), completionDeadline: days(20),
};

describe("validateStudyInput", () => {
  it("accepte l'exemple du spec", () => {
    const r = validateStudyInput(base, NOW);
    expect(r.ok).toBe(true);
  });
  it.each([
    [{ type: "visit", scope: "national" }, "visit_requires_department"],
    [{ minParticipants: 201 }, "min_gt_max"],
    [{ maxParticipants: 501 }, "max_too_high"],
    [{ minParticipants: 4 }, "min_too_low"],
    [{ rewardCents: 99 }, "reward_too_low"],
    [{ signupDeadline: days(1) }, "signup_deadline_invalid"],
    [{ signupDeadline: days(61) }, "signup_deadline_invalid"],
    [{ completionDeadline: days(12) }, "completion_deadline_invalid"],
    [{ completionDeadline: days(71) }, "completion_deadline_invalid"],
    [{ externalUrl: "http://example.com" }, "url_not_https"],
    [{ scope: "department", department: null }, "department_required"],
    [{ type: "colis" }, "type_invalid"],
    [{ title: "ab" }, "title_invalid"],
  ])("rejette %o → %s", (patch, error) => {
    expect(validateStudyInput({ ...base, ...patch }, NOW)).toEqual({ ok: false, error });
  });
  it("normalise le département (2A, 64)", () => {
    const r = validateStudyInput({ ...base, scope: "department", department: "64" }, NOW);
    expect(r.ok && r.value.department).toBe("64");
    const bad = validateStudyInput({ ...base, scope: "department", department: "99" }, NOW);
    expect(bad).toEqual({ ok: false, error: "department_invalid" });
  });
});

describe("budget", () => {
  it("coût unitaire = rémunération + commission (10 %, min 0,30 €)", () => {
    expect(studyUnitCostCents(200)).toBe(230);
    expect(studyUnitCostCents(1000)).toBe(1100);
  });
  it("budget max de l'exemple = 460 €", () => {
    expect(studyBudgetMaxCents(200, 200)).toBe(46000);
  });
});

describe("departmentFromPostalCode", () => {
  it.each([["64000", "64"], ["20000", "2A"], ["20200", "2B"], ["97400", "974"], ["01000", "01"], [null, null], ["abc", null], ["", null]])(
    "%s → %s", (cp, d) => expect(departmentFromPostalCode(cp as string | null)).toBe(d));
});

describe("studyBadge", () => {
  it("remaining", () => expect(studyBadge({ status: "published", joinedCount: 12, min: 50, max: 200 })).toEqual({ key: "remaining", label: "Plus que 38 participants" }));
  it("singulier", () => expect(studyBadge({ status: "published", joinedCount: 49, min: 50, max: 200 }).label).toBe("Plus que 1 participant"));
  it("open", () => expect(studyBadge({ status: "published", joinedCount: 50, min: 50, max: 200 })).toEqual({ key: "open", label: "Inscriptions ouvertes" }));
  it("full", () => expect(studyBadge({ status: "validated", joinedCount: 200, min: 50, max: 200 })).toEqual({ key: "full", label: "Complète" }));
  it("validated", () => expect(studyBadge({ status: "validated", joinedCount: 80, min: 50, max: 200 }).key).toBe("validated"));
  it("canceled", () => expect(studyBadge({ status: "canceled", joinedCount: 3, min: 50, max: 200 }).label).toBe("Annulée"));
});

describe("codes", () => {
  it("format BU-XXXX sans caractères ambigus", () => {
    for (let i = 0; i < 200; i++) expect(generateParticipationCode()).toMatch(/^BU-[A-HJ-NP-Z2-9]{4}$/);
  });
});

describe("toProParticipant", () => {
  it("ne laisse sortir aucune donnée sensible", () => {
    const out = toProParticipant({
      id: "p", status: "done", code: "BU-ABCD", done_comment: "ok", done_at: "x", review_due_at: "y",
      prenom: "Léa", alias: "prospect+rabc@mail.buupp.com", email: "lea@x.fr", nom: "Martin", telephone: "06", department: "64",
    });
    expect(out).toEqual({ id: "p", prenom: "Léa", alias: "prospect+rabc@mail.buupp.com", code: "BU-ABCD", status: "done", doneComment: "ok", doneAt: "x", reviewDueAt: "y" });
  });
});
