import { describe, it, expect, afterEach } from "vitest";
import { isAdminEmail, hasCronAuthorization } from "@/lib/admin/access";

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

describe("hasCronAuthorization", () => {
  const originalAdmin = process.env.BUUPP_ADMIN_SECRET;
  const originalCron = process.env.CRON_SECRET;
  afterEach(() => {
    process.env.BUUPP_ADMIN_SECRET = originalAdmin;
    process.env.CRON_SECRET = originalCron;
  });

  const req = (headers: Record<string, string>) =>
    new Request("https://www.buupp.com/api/admin/digest?severity=daily", {
      headers,
    });

  it("accepte le déclenchement manuel via x-admin-secret", () => {
    process.env.BUUPP_ADMIN_SECRET = "s3cret";
    delete process.env.CRON_SECRET;
    expect(hasCronAuthorization(req({ "x-admin-secret": "s3cret" }))).toBe(true);
  });

  it("accepte le Bearer CRON_SECRET posé par Vercel", () => {
    delete process.env.BUUPP_ADMIN_SECRET;
    process.env.CRON_SECRET = "cron-token";
    expect(
      hasCronAuthorization(req({ authorization: "Bearer cron-token" })),
    ).toBe(true);
  });

  it("accepte l'en-tête x-vercel-cron (repli sans CRON_SECRET)", () => {
    delete process.env.BUUPP_ADMIN_SECRET;
    delete process.env.CRON_SECRET;
    expect(hasCronAuthorization(req({ "x-vercel-cron": "1" }))).toBe(true);
  });

  it("rejette une requête anonyme", () => {
    process.env.BUUPP_ADMIN_SECRET = "s3cret";
    process.env.CRON_SECRET = "cron-token";
    expect(hasCronAuthorization(req({}))).toBe(false);
  });

  it("rejette un mauvais secret", () => {
    process.env.BUUPP_ADMIN_SECRET = "s3cret";
    process.env.CRON_SECRET = "cron-token";
    expect(hasCronAuthorization(req({ "x-admin-secret": "wrong" }))).toBe(false);
    expect(hasCronAuthorization(req({ authorization: "Bearer wrong" }))).toBe(
      false,
    );
  });
});
