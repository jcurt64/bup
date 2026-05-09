/**
 * Aiguillage post-authentification : on lit le rôle DB et on redirige.
 *
 * On garde ce point de passage minimal :
 *   - 1 appel `auth()` (instantané)
 *   - 1 appel `getCurrentRole()` (2 SELECT parallèles avec maybeSingle)
 *   - redirect()
 *
 * Ancienne version : on appelait aussi `currentUser()` puis
 * `clerkClient.users.getUser()` + `updateUser()` pour resyncer
 * publicMetadata. Cette resync n'est PAS nécessaire ici — `ensureRole()`
 * sur /prospect et /pro la fait déjà — et chaque appel Clerk Admin
 * ajoutait un point de défaillance : sur hoquet réseau la page restait
 * blanche au lieu de rediriger. Le rôle metadata Clerk est juste un
 * cache ; la DB fait foi.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk/server";
import { getCurrentRole } from "@/lib/sync/currentRole";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: "noindex",
  title: "BUUPP — Redirection",
};

export default async function PostLoginPage() {
  const { userId } = await auth();
  if (!userId) redirect("/connexion");

  let role: "prospect" | "pro" | null = null;
  try {
    role = await getCurrentRole(userId);
  } catch (err) {
    // En cas d'erreur DB, on n'écrase pas la session : on envoie le user
    // sur la page d'aiguillage pour qu'il rechoisisse explicitement.
    console.error("[/auth/post-login] getCurrentRole failed", err);
    redirect("/inscription");
  }

  if (role === "pro") redirect("/pro");
  if (role === "prospect") redirect("/prospect");

  // User Clerk valide mais aucune row DB encore (signup juste avant
  // que /prospect ou /pro ait pu appeler ensureRole). On envoie sur
  // l'aiguillage pour qu'il choisisse son rôle explicitement.
  redirect("/inscription");
}
