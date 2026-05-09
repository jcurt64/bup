/**
 * Proxy Next.js 16 (ex-`middleware.ts`) — câble Clerk pour gérer
 * l'auth sur toutes les routes du site.
 *
 * Routes publiques : landing, liste d'attente, page connexion, RGPD, webhooks.
 * Tout le reste (espace prospect, pro, API métier) requiert un user Clerk.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { Role } from "@/lib/sync/ensureRole";

const isPublicRoute = createRouteMatcher([
  "/",
  "/liste-attente",
  "/connexion(.*)",
  "/inscription(.*)",
  // ─── Pages d'information publiques (footer "Ressources" et "Légal")
  // Doivent être accessibles sans authentification : ce sont des pages
  // institutionnelles (légales, support, statut, accessibilité, etc.).
  "/bareme",
  "/aide",
  "/status",
  "/accessibilite",
  "/minimisation",
  "/cgu",
  "/cgv",
  "/rgpd",
  "/cookies",
  "/contact-dpo",
  // /feedback : atterrissage des liens dans les e-mails de relation
  // refusée — explicitement public (cf. app/feedback/page.tsx).
  "/feedback",
  // ─── API publiques
  "/api/me/(.*)",
  "/api/clerk/webhook",
  "/api/stripe/webhook",
  "/api/waitlist",
  "/api/waitlist/stats",
  "/api/plan-pricing",
  "/api/landing/(.*)",
  // ─── API admin : pas de session Clerk requise. Chaque handler
  // valide lui-même un secret via le header `x-admin-secret`
  // (cf. app/api/admin/waitlist/launch-email/route.ts).
  "/api/admin/(.*)",
]);

// `clerkMiddleware` retourne une fonction de signature compatible avec
// la nouvelle convention `proxy` : Next.js 16 l'invoque exactement comme
// l'ancien middleware. Le rename n'affecte que le NOM du fichier et de
// l'export ; la signature handler reste identique.
//
// On n'utilise PAS `auth.protect()` car son redirectToSignIn interne
// est appelé sans `returnBackUrl` (cf. @clerk/nextjs/dist/esm/server/
// protect.js → `redirectToSignIn()` sans args). Conséquence : la page
// /connexion reçoit une URL sans `?redirect_url=…`, son `target` est
// undefined, on retombe sur fallback /auth/post-login qui route par
// rôle existant — un user pro qui cliquait « Je suis prospect » se
// retrouvait alors sur /pro au lieu de /prospect. On redirige donc
// nous-mêmes en passant returnBackUrl pour que /connexion sache où
// renvoyer après auth.
// Helper : extrait le premier segment du pathname pour matcher exactement
// /prospect ou /pro (pas leurs préfixes). split("/")[1] sur "/prospect/x"
// renvoie "prospect", sur "/pro" renvoie "pro" — pas de faux positif.
function pathRoleSegment(pathname: string): Role | null {
  const seg = pathname.split("/")[1] ?? "";
  if (seg === "prospect") return "prospect";
  if (seg === "pro") return "pro";
  return null;
}

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;
  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: request.url });
  }

  // Garde de rôle au niveau middleware — fast path basé sur les claims
  // du session token Clerk (publicMetadata.role). Évite que le rendu
  // RSC de /prospect ou /pro démarre alors qu'on sait déjà qu'il y a
  // mismatch — l'utilisateur voyait sinon une page blanche le temps
  // que la redirection serveur du page.tsx soit prise en compte.
  // Si le metadata est stale (ex. role vient d'être resync côté DB
  // mais le token client n'a pas été rafraîchi), la garde DB côté
  // page.tsx reste la dernière ligne — on ne refuse une cible QUE si
  // les claims affirment positivement un rôle qui contredit la cible.
  const targetRole = pathRoleSegment(request.nextUrl.pathname);
  if (targetRole) {
    const claimedRole = (
      sessionClaims?.publicMetadata as { role?: Role } | undefined
    )?.role;
    if (
      (targetRole === "prospect" && claimedRole === "pro") ||
      (targetRole === "pro" && claimedRole === "prospect")
    ) {
      return NextResponse.redirect(
        new URL(`/?role_conflict=${claimedRole}`, request.url),
      );
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, sauf si on les recherche dans search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
