/**
 * Logique pure du routage post-authentification. Aucune I/O ici :
 * `/auth/post-login` orchestre les effets (auth, DB, ensureRole) et
 * délègue la DÉCISION à `resolvePostAuth`. L'intention du bouton fait
 * foi — jamais le rôle DB.
 */
import type { Role } from "@/lib/sync/ensureRole";

export type AuthMode = "signin" | "signup";

export type PostAuthDecision =
  | { kind: "go"; intent: Role }
  | { kind: "ensure"; intent: Role }
  | { kind: "conflict"; intent: Role; existingRole: Role };

export function resolvePostAuth(args: {
  intent: Role;
  role: Role | null;
}): PostAuthDecision {
  const { intent, role } = args;
  if (role === null) return { kind: "ensure", intent };
  if (role === intent) return { kind: "go", intent };
  return { kind: "conflict", intent, existingRole: role };
}

export function buildConflictUrl(args: {
  intent: Role;
  mode: AuthMode;
  existingRole: Role;
}): string {
  const { intent, mode, existingRole } = args;
  if (mode === "signup") {
    return `/inscription/${intent}?conflict=${existingRole}`;
  }
  return `/connexion?intent=${intent}&conflict=${existingRole}`;
}

export function parseRole(
  raw: string | string[] | undefined,
): Role | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "prospect" || v === "pro") return v;
  return null;
}

export function parseMode(raw: string | string[] | undefined): AuthMode {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "signup" ? "signup" : "signin";
}

/**
 * Destination d'un utilisateur authentifié arrivant sur /auth/post-login
 * SANS intent exploitable (ni `?intent=`, ni cookie d'intent).
 *
 * ⚠️ Ne JAMAIS renvoyer vers `/connexion` ici. Cette page court-circuite
 * les utilisateurs déjà signés vers /auth/post-login : la paire boucle
 * indéfiniment (ERR_TOO_MANY_REDIRECTS). Le cas s'est produit en
 * production le 28/07/2026 après la remise à zéro de la base — tous les
 * comptes Clerk survivants se sont retrouvés sans ligne prospect ni pro,
 * donc sans rôle, ce qui était jusque-là un état impossible.
 *
 * Sans rôle, la home est la seule destination sensée : c'est de là qu'on
 * choisit « Je suis prospect » ou « Je suis professionnel ». Elle est
 * publique, donc terminale — aucun risque de rebond.
 */
export function resolvePostLoginFallback(role: Role | null): string {
  if (role === "pro") return "/pro";
  if (role === "prospect") return "/prospect";
  return "/";
}
