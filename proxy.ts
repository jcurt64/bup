/**
 * Proxy Next.js 16 (ex-`middleware.ts`) — câble Clerk pour gérer
 * l'auth sur toutes les routes du site.
 *
 * Routes publiques : landing, liste d'attente, page connexion, RGPD, webhooks.
 * Tout le reste (espace prospect, pro, API métier) requiert un user Clerk.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/sync/ensureRole";
import { isAdminEmail } from "@/lib/admin/access";

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
  "/contact-dpo/formulaire",
  // /feedback : atterrissage des liens dans les e-mails de relation
  // refusée — explicitement public (cf. app/feedback/page.tsx).
  "/feedback",
  // ─── API publiques
  "/api/me/(.*)",
  "/api/clerk/webhook",
  "/api/stripe/webhook",
  "/api/waitlist",
  "/api/waitlist/stats",
  // Endpoint du formulaire DPO : accessible aux visiteurs anonymes (cas
  // d'un ancien utilisateur dont le compte a été supprimé et qui veut
  // exercer un droit RGPD résiduel). Honeypot + validation côté handler.
  "/api/contact-dpo",
  "/api/plan-pricing",
  "/api/landing/(.*)",
  // Pixel de tracking des broadcasts admin : fetch depuis le client mail
  // du destinataire, qui ne porte évidemment aucune session Clerk. Le
  // recipient_id (UUID v4) sert d'identifiant opaque non énumérable.
  "/api/broadcasts/track/(.*)",
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

// Détecte si la requête entre dans /inscription/prospect ou
// /inscription/pro. On utilise ça pour poser un cookie d'intent
// que /auth/post-login pourra lire si Clerk perd la query string
// pendant ses redirections internes.
function inscriptionIntent(pathname: string): Role | null {
  if (pathname === "/inscription/prospect" || pathname.startsWith("/inscription/prospect/")) {
    return "prospect";
  }
  if (pathname === "/inscription/pro" || pathname.startsWith("/inscription/pro/")) {
    return "pro";
  }
  return null;
}

const INTENT_COOKIE = "bupp_auth_intent";

export default clerkMiddleware(async (auth, request) => {
  // Étape 1 — pose le cookie d'intent dès qu'on entre dans
  // /inscription/{prospect,pro}. Le cookie survit aux redirections
  // Clerk (auto-conversion signup→signin, navigation vers /connexion,
  // etc.) qui peuvent perdre la query string du forceRedirectUrl.
  // /auth/post-login lit ensuite ce cookie en fallback de ?intent=.
  const intentToSet = inscriptionIntent(request.nextUrl.pathname);
  if (intentToSet) {
    const res = NextResponse.next();
    res.cookies.set(INTENT_COOKIE, intentToSet, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 30, // 30 min — couvre largement un flow d'auth
      path: "/",
    });
    return res;
  }

  // Étape 2 — quand /auth/post-login va s'exécuter, on programme la
  // suppression du cookie SUR LA RÉPONSE (pas la requête : la page
  // doit encore pouvoir le lire pour décider du redirect). Ça évite
  // qu'un intent stale d'un flow précédent soit réutilisé par
  // erreur sur une connexion ultérieure via /connexion.
  if (request.nextUrl.pathname === "/auth/post-login") {
    const res = NextResponse.next();
    res.cookies.set(INTENT_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  if (isPublicRoute(request)) return;

  // ─── Garde back-office /buupp-admin ──────────────────────────────
  // Anonyme → redirige vers /connexion avec returnBackUrl. Le formulaire
  // /connexion respecte forceRedirectUrl (cf. app/connexion/[[...]]/page.tsx)
  // et ramène l'utilisateur sur /buupp-admin après login.
  // Connecté mais pas admin → 404 (ne révèle pas l'existence du dashboard
  // à un user non habilité qui aurait deviné l'URL).
  // La layout /buupp-admin re-vérifie côté RSC (ceinture + bretelles).
  if (request.nextUrl.pathname.startsWith("/buupp-admin")) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) {
      return redirectToSignIn({ returnBackUrl: request.url });
    }
    // Email primaire : pas de claim custom dans le JWT par défaut → on
    // appelle Clerk côté serveur. Edge runtime OK pour clerkClient.
    const { clerkClient } = await import("@clerk/nextjs/server");
    const cc = await clerkClient();
    const u = await cc.users.getUser(userId);
    const email = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? null;
    if (!isAdminEmail(email)) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
    return; // admin OK, laisser passer
  }

  const { userId, sessionClaims, redirectToSignIn } = await auth();
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: request.url });
  }

  // Garde de rôle au niveau middleware — DB-authoritative.
  //
  // On a besoin que le redirect parte AVANT que /prospect ou /pro ne
  // démarre leur rendu RSC, sinon on observait : URL /prospect, page
  // blanche, bottom nav qui affiche le rôle réel du user (via
  // /api/me/role côté client). La garde page-level dans page.tsx
  // ferait le travail mais peut être lente, et streaming RSC affiche
  // déjà la layout (incluant la nav) avant que le redirect ne prenne
  // effet — d'où l'incohérence visuelle.
  //
  // Première tentative : claims du session token Clerk
  // (publicMetadata.role). Instantané, mais nécessite que le JWT
  // template Clerk inclue publicMetadata — ce n'est pas le cas par
  // défaut, donc claimedRole est souvent undefined.
  //
  // Fallback : query DB directe via fetch sur l'API REST Supabase
  // (PostgREST). Fonctionne en runtime Edge, ajoute ~50 ms qu'on
  // accepte volontiers vu le bug que ça résout.
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
    // Pas de claim disponible (cas par défaut sans JWT template
    // custom) → on demande à la DB.
    if (!claimedRole) {
      const dbRole = await getRoleFromDB(userId);
      if (
        (targetRole === "prospect" && dbRole === "pro") ||
        (targetRole === "pro" && dbRole === "prospect")
      ) {
        return NextResponse.redirect(
          new URL(`/?role_conflict=${dbRole}`, request.url),
        );
      }
    }
  }
});

async function getRoleFromDB(clerkUserId: string): Promise<Role | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const [{ data: proRow }, { data: prospectRow }] = await Promise.all([
      supabase.from("pro_accounts").select("id").eq("clerk_user_id", clerkUserId).maybeSingle(),
      supabase.from("prospects").select("id").eq("clerk_user_id", clerkUserId).maybeSingle(),
    ]);
    if (proRow) return "pro";
    if (prospectRow) return "prospect";
    return null;
  } catch (err) {
    console.error("[proxy] getRoleFromDB failed", err);
    return null;
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, sauf si on les recherche dans search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
