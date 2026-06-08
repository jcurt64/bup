import { describe, expect, it } from "vitest";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";

describe("proCanSeeContacts", () => {
  it("autorise uniquement quand la campagne est clôturée", () => {
    expect(proCanSeeContacts("completed")).toBe(true);
    expect(proCanSeeContacts("active")).toBe(false);
    expect(proCanSeeContacts("paused")).toBe(false);
    expect(proCanSeeContacts("draft")).toBe(false);
    expect(proCanSeeContacts("canceled")).toBe(false);
    expect(proCanSeeContacts(null)).toBe(false);
    expect(proCanSeeContacts(undefined)).toBe(false);
  });
});
