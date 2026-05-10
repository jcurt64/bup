import { describe, it, expect, afterEach } from "vitest";
import { isAdminEmail } from "@/lib/admin/access";

describe("isAdminEmail", () => {
  const original = process.env.ADMIN_EMAILS;
  afterEach(() => {
    process.env.ADMIN_EMAILS = original;
  });

  it("retourne false si ADMIN_EMAILS est vide (fail-closed)", () => {
    process.env.ADMIN_EMAILS = "";
    expect(isAdminEmail("jjlex64@gmail.com")).toBe(false);
  });

  it("retourne false si l'env n'est pas définie", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("jjlex64@gmail.com")).toBe(false);
  });

  it("matche un email exact dans la liste", () => {
    process.env.ADMIN_EMAILS = "jjlex64@gmail.com,other@buupp.fr";
    expect(isAdminEmail("jjlex64@gmail.com")).toBe(true);
    expect(isAdminEmail("other@buupp.fr")).toBe(true);
  });

  it("est insensible à la casse et trim les espaces", () => {
    process.env.ADMIN_EMAILS = " JJlex64@Gmail.com , other@buupp.fr ";
    expect(isAdminEmail("jjlex64@gmail.com")).toBe(true);
    expect(isAdminEmail("OTHER@BUUPP.FR")).toBe(true);
  });

  it("rejette un email non listé", () => {
    process.env.ADMIN_EMAILS = "jjlex64@gmail.com";
    expect(isAdminEmail("attacker@evil.com")).toBe(false);
  });

  it("retourne false pour input vide/null", () => {
    process.env.ADMIN_EMAILS = "jjlex64@gmail.com";
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
