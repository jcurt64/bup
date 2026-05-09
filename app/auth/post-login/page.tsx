/**
 * Aiguillage post-authentification : lit le rôle DB et redirige.
 *
 * Reçoit éventuellement `?intent=prospect|pro` quand l'utilisateur
 * arrive depuis /inscription/{prospect,pro}. Si l'intent contredit
 * son rôle DB réel (typiquement : email déjà utilisé par un compte
 * pro et Clerk auto-convertit le signup en signin), on l'envoie sur
 * la home avec ?role_conflict=… pour que le toast explique la
 * situation. Sinon on route normalement.
 *
 * On garde ce point de passage minimal :
 *   - 1 appel `auth()`
 *   - 1 appel `getCurrentRole()` (2 SELECT parallèles avec maybeSingle)
 *   - redirect()
 *
 * Pas d'appel Clerk Admin API ici — la resync metadata est déjà faite
 * par `ensureRole()` au premier hit de /prospect ou /pro, et chaque
 * appel Clerk Admin ajoutait un point de défaillance qui pouvait
 * laisser la page blanche au lieu de rediriger.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk/server";
import { getCurrentRole } from "@/lib/sync/currentRole";
import type { Role } from "@/lib/sync/ensureRole";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: "noindex",
  title: "BUUPP — Redirection",
};

type SearchParams = Promise<{ intent?: string | string[] }>;

function parseIntent(raw: string | string[] | undefined): Role | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "prospect" || v === "pro") return v;
  return null;
}

export default async function PostLoginPage(props: {
  searchParams: SearchParams;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/connexion");

  const sp = await props.searchParams;
  const intent = parseIntent(sp.intent);

  let role: Role | null = null;
  try {
    role = await getCurrentRole(userId);
  } catch (err) {
    // En cas d'erreur DB, on n'écrase pas la session : on envoie le user
    // sur la page d'aiguillage pour qu'il rechoisisse explicitement.
    console.error("[/auth/post-login] getCurrentRole failed", err);
    redirect("/inscription");
  }

  // Mismatch intent ↔ rôle DB : l'utilisateur a tenté de s'inscrire
  // dans un espace qui ne correspond pas à son compte existant. On
  // l'envoie sur la home avec le toast — pas sur /prospect ou /pro
  // qui aurait pu rester blanc le temps de leur garde page-level.
  if (intent && role && intent !== role) {
    redirect(`/?role_conflict=${role}`);
  }

  if (role === "pro") redirect("/pro");
  if (role === "prospect") redirect("/prospect");

  // User Clerk valide mais aucune row DB encore (signup juste avant
  // que /prospect ou /pro ait pu appeler ensureRole). On utilise
  // l'intent si disponible, sinon on l'envoie sur l'aiguillage.
  if (intent === "prospect") redirect("/prospect");
  if (intent === "pro") redirect("/pro");
  redirect("/inscription");
}
