/**
 * Helper unifié de création / vérification de rôle. Mirroir des deux
 * helpers existants (`ensureProspect`, `ensureProAccount`) avec :
 *   - un seul point d'entrée pour l'app (UI / pages serveur).
 *   - une détection du conflit côté trigger Postgres (code 23505) qu'on
 *     traduit en `RoleConflictError` typé.
 *   - propagation de `publicMetadata.role` côté Clerk (cache de lecture).
 *
 * La DB fait foi : si la propagation Clerk échoue, on log mais on ne
 * throw pas (le rôle sera resyncé par /api/me au prochain accès).
 */

import type { PostgrestError } from "@supabase/supabase-js";
import { clerkClient } from "@/lib/clerk/server";
import { ensureProspect } from "./prospects";
import { ensureProAccount } from "./pro-accounts";

export type Role = "prospect" | "pro";

export class RoleConflictError extends Error {
  readonly existingRole: Role;
  constructor(existingRole: Role) {
    super(`role_conflict:${existingRole}`);
    this.name = "RoleConflictError";
    this.existingRole = existingRole;
  }
}

function isPgUniqueViolation(err: unknown): boolean {
  // Erreurs Supabase exposent un code SQLSTATE dans `code` (PostgrestError)
  // ou via `message` (raw pg). 23505 = unique_violation, levé par notre trigger.
  if (!err || typeof err !== "object") return false;
  const e = err as Partial<PostgrestError> & { message?: string };
  if (e.code === "23505") return true;
  return typeof e.message === "string" && e.message.includes("role_conflict");
}

export type EnsureRoleIdentity = {
  prenom?: string | null;
  nom?: string | null;
  raisonSociale?: string | null;
};

export async function ensureRole(
  userId: string,
  email: string | null,
  role: Role,
  identity?: EnsureRoleIdentity,
): Promise<void> {
  try {
    if (role === "prospect") {
      await ensureProspect({
        clerkUserId: userId,
        email,
        prenom: identity?.prenom ?? null,
        nom: identity?.nom ?? null,
      });
    } else {
      await ensureProAccount({
        clerkUserId: userId,
        email,
        raisonSociale: identity?.raisonSociale ?? null,
      });
    }
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      const existing: Role = role === "prospect" ? "pro" : "prospect";
      throw new RoleConflictError(existing);
    }
    throw err;
  }

  try {
    const client = await clerkClient();
    await client.users.updateUser(userId, { publicMetadata: { role } });
  } catch (err) {
    // Volontairement non-bloquant — la DB fait foi.
    console.error("[ensureRole] failed to update Clerk publicMetadata", err);
  }
}
