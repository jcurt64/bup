/**
 * Lecture pure du rôle d'un user Clerk côté serveur — aucune écriture.
 *
 * Source de vérité : la DB Supabase (présence d'une row `pro_accounts`
 * ou `prospects`). Ne PAS confondre avec `ensureRole` qui crée la row
 * si elle manque : ici on veut juste savoir, pas matérialiser.
 *
 * Utilisé par les Server Components `/prospect` et `/pro` pour
 * intercepter un mismatch de rôle AVANT d'appeler `ensureRole` (qui,
 * sur certaines bases legacy avec rows présentes dans les deux tables,
 * ne lèverait pas le RoleConflictError attendu).
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Role } from "./ensureRole";

export async function getCurrentRole(clerkUserId: string): Promise<Role | null> {
  const admin = createSupabaseAdminClient();
  const [{ data: proRow, error: proErr }, { data: prospectRow, error: prospectErr }] =
    await Promise.all([
      admin
        .from("pro_accounts")
        .select("id")
        .eq("clerk_user_id", clerkUserId)
        .maybeSingle(),
      admin
        .from("prospects")
        .select("id")
        .eq("clerk_user_id", clerkUserId)
        .maybeSingle(),
    ]);

  if (proErr) throw proErr;
  if (prospectErr) throw prospectErr;

  // Priorité au rôle pro si pour une raison historique les deux rows
  // existent (legacy data antérieure au trigger d'exclusivité).
  if (proRow) return "pro";
  if (prospectRow) return "prospect";
  return null;
}
