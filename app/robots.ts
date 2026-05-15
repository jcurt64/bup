/**
 * /robots.txt — généré dynamiquement par Next.js (App Router).
 *
 * Politique : on autorise l'indexation des pages publiques (home,
 * waitlist, footer Ressources/Légal). On INTERDIT explicitement tout
 * ce qui est protégé par auth Clerk (espaces prospect/pro/admin) et
 * tous les endpoints API.
 *
 * Le sitemap est référencé depuis `/sitemap.xml` (cf. `app/sitemap.ts`).
 */

import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.buupp.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/connexion",
          "/inscription/",
          "/buupp-admin",
          "/buupp-admin/",
          "/prospect",
          "/prospect/",
          "/pro",
          "/pro/",
          "/feedback",
          "/prototype/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
