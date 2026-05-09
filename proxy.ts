/**
 * Proxy Next.js 16 (ex-`middleware.ts`) — câble Clerk pour gérer
 * l'auth sur toutes les routes du site.
 *
 * Routes publiques : landing, liste d'attente, page connexion, RGPD, webhooks.
 * Tout le reste (espace prospect, pro, API métier) requiert un user Clerk.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;
  const { userId, redirectToSignIn } = await auth();
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: request.url });
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
