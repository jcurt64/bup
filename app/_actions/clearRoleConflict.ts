"use server";

import { cookies } from "next/headers";

/**
 * Server Action appelée par RoleConflictToast au montage côté client.
 * `cookies().delete()` n'est autorisé qu'en Server Action / Route Handler
 * (pas pendant le render d'un Server Component) en Next.js 16.
 */
export async function clearRoleConflictCookie(): Promise<void> {
  const c = await cookies();
  c.delete("role_conflict");
}
