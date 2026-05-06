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
  "/bareme",
  "/rgpd",
  "/api/clerk/webhook",
  "/api/stripe/webhook",
  "/api/waitlist",
  "/api/waitlist/stats",
  "/api/plan-pricing",
  "/api/landing/(.*)",
]);

// `clerkMiddleware` retourne une fonction de signature compatible avec
// la nouvelle convention `proxy` : Next.js 16 l'invoque exactement comme
// l'ancien middleware. Le rename n'affecte que le NOM du fichier et de
// l'export ; la signature handler reste identique.
export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
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
