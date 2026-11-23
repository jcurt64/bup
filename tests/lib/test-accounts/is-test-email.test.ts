import { describe, expect, it } from "vitest";
import { isTestEmail } from "@/lib/test-accounts";

describe("isTestEmail", () => {
  it("reconnaît le sous-adressage de test Clerk", () => {
    expect(isTestEmail("test-pro+clerk_test@buupp.com")).toBe(true);
    expect(isTestEmail("jjlex64+clerk_test1@gmail.com")).toBe(true);
    expect(isTestEmail("Someone+TEST@gmail.com")).toBe(true);
  });
  it("laisse passer les vraies adresses", () => {
    expect(isTestEmail("marie.dupont@gmail.com")).toBe(false);
    expect(isTestEmail("testament@gmail.com")).toBe(false);
    expect(isTestEmail("paul+newsletter@gmail.com")).toBe(false);
    expect(isTestEmail(null)).toBe(false);
  });
});
