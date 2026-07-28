import { describe, it, expect } from "vitest";
import {
  resolvePostAuth,
  buildConflictUrl,
  parseRole,
  parseMode,
  resolvePostLoginFallback,
} from "@/lib/auth/postAuth";

describe("resolvePostAuth", () => {
  it("role null → ensure (création différée)", () => {
    expect(resolvePostAuth({ intent: "pro", role: null })).toEqual({
      kind: "ensure",
      intent: "pro",
    });
  });

  it("role == intent → go", () => {
    expect(resolvePostAuth({ intent: "prospect", role: "prospect" })).toEqual({
      kind: "go",
      intent: "prospect",
    });
  });

  it("role != intent → conflict avec le rôle existant", () => {
    expect(resolvePostAuth({ intent: "pro", role: "prospect" })).toEqual({
      kind: "conflict",
      intent: "pro",
      existingRole: "prospect",
    });
  });
});

describe("buildConflictUrl", () => {
  it("signup → page d'inscription de l'intent + ?conflict", () => {
    expect(
      buildConflictUrl({ intent: "pro", mode: "signup", existingRole: "prospect" }),
    ).toBe("/inscription/pro?conflict=prospect");
  });

  it("signin → /connexion avec intent + conflict", () => {
    expect(
      buildConflictUrl({ intent: "prospect", mode: "signin", existingRole: "pro" }),
    ).toBe("/connexion?intent=prospect&conflict=pro");
  });
});

describe("parseRole", () => {
  it("accepte prospect / pro", () => {
    expect(parseRole("pro")).toBe("pro");
    expect(parseRole("prospect")).toBe("prospect");
  });
  it("prend le 1er élément d'un tableau", () => {
    expect(parseRole(["prospect", "pro"])).toBe("prospect");
  });
  it("rejette le reste → null", () => {
    expect(parseRole("admin")).toBeNull();
    expect(parseRole(undefined)).toBeNull();
  });
});

describe("parseMode", () => {
  it("signup explicite", () => {
    expect(parseMode("signup")).toBe("signup");
  });
  it("défaut = signin (filet sûr → renvoie vers connexion)", () => {
    expect(parseMode(undefined)).toBe("signin");
    expect(parseMode("nimporte")).toBe("signin");
  });
});

describe("resolvePostLoginFallback", () => {
  // Régression du 28/07/2026 : après la remise à zéro de la base, tout
  // compte Clerk survivant s'est retrouvé sans ligne prospect ni pro.
  // L'ancienne implémentation renvoyait alors vers /connexion, qui
  // court-circuite les déjà-signés vers /auth/post-login → boucle infinie
  // (ERR_TOO_MANY_REDIRECTS) constatée en production.
  it("sans rôle → la home, JAMAIS /connexion (boucle)", () => {
    expect(resolvePostLoginFallback(null)).toBe("/");
    expect(resolvePostLoginFallback(null)).not.toBe("/connexion");
  });

  it("rôle connu → espace correspondant", () => {
    expect(resolvePostLoginFallback("pro")).toBe("/pro");
    expect(resolvePostLoginFallback("prospect")).toBe("/prospect");
  });
});
