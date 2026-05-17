/**
 * Aiguillage post-authentification — INTENT-AUTHORITATIVE.
 *
 * L'intention du bouton (query `?intent=` puis fallback cookie
 * `bupp_auth_intent`) fait foi. On ne route JAMAIS vers l'espace
 * opposé : si le compte existant contredit l'intent, on renvoie sur
 * la fenêtre Clerk correspondante avec `?conflict=<roleExistant>`
 * pour afficher la bannière.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth, currentUser } from "@/lib/clerk/server";
import { getCurrentRole } from "@/lib/sync/currentRole";
import { ensureRole, RoleConflictError } from "@/lib/sync/ensureRole";
import type { Role } from "@/lib/sync/ensureRole";
import { safeRedirect } from "@/lib/auth/safeRedirect";
import {
  resolvePostAuth,
  buildConflictUrl,
  parseRole,
  parseMode,
} from "@/lib/auth/postAuth";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: "noindex",
  title: "BUUPP — Redirection",
};

type SearchParams = Promise<{
  intent?: string | string[];
  mode?: string | string[];
  redirect_url?: string | string[];
}>;

export default async function PostLoginPage(props: {
  searchParams: SearchParams;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/connexion");

  const sp = await props.searchParams;
  const explicitTarget = safeRedirect(sp.redirect_url);
  const mode = parseMode(sp.mode);
  const intent: Role | null =
    parseRole(sp.intent) ??
    parseRole((await cookies()).get("bupp_auth_intent")?.value);

  // Pas d'intent exploitable (hors parcours bouton — ne devrait pas
  // arriver via l'UI). On lit le rôle DB et on route au mieux.
  if (!intent) {
    let fallbackRole: Role | null = null;
    try {
      fallbackRole = await getCurrentRole(userId);
    } catch (err) {
      console.error("[/auth/post-login] getCurrentRole failed", err);
    }
    if (fallbackRole === "pro") redirect("/pro");
    if (fallbackRole === "prospect") redirect("/prospect");
    redirect("/connexion");
  }

  let role: Role | null = null;
  try {
    role = await getCurrentRole(userId);
  } catch (err) {
    console.error("[/auth/post-login] getCurrentRole failed", err);
    redirect(`/connexion?intent=${intent}&mode=${mode}`);
  }

  const decision = resolvePostAuth({ intent, role });

  if (decision.kind === "conflict") {
    redirect(
      buildConflictUrl({ intent, mode, existingRole: decision.existingRole }),
    );
  }

  if (decision.kind === "ensure") {
    const user = await currentUser();
    const primary = user?.emailAddresses?.find(
      (e) => e.id === user.primaryEmailAddressId,
    );
    try {
      await ensureRole(userId, primary?.emailAddress ?? null, intent, {
        prenom: user?.firstName ?? null,
        nom: user?.lastName ?? null,
      });
    } catch (err) {
      if (err instanceof RoleConflictError) {
        redirect(
          buildConflictUrl({ intent, mode, existingRole: err.existingRole }),
        );
      }
      throw err;
    }
  }

  redirect(explicitTarget ?? `/${intent}`);
}
