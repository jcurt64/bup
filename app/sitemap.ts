/**
 * /sitemap.xml — généré dynamiquement par Next.js (App Router).
 *
 * On référence uniquement les pages publiques destinées aux moteurs
 * de recherche : home, liste d'attente, et les 10 pages du footer
 * (sections Ressources et Légal). Les pages d'authentification
 * (/connexion, /inscription/*), l'espace prospect/pro/admin et les
 * API sont explicitement EXCLUES (cf. `app/robots.ts`).
 *
 * `lastModified` reflète la date de dernière modification éditoriale
 * connue. Pour les pages versionnées (cf. `app/_components/page-versions.ts`),
 * on lit la date du dernier bump du registre central. Pour les autres
 * (home, liste-attente), on utilise la date courante.
 */

import type { MetadataRoute } from "next";
import { PAGE_VERSIONS, type PageMeta } from "./_components/page-versions";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.buupp.com";

function lastModifiedFor(meta: PageMeta): Date {
  const last = meta.history[meta.history.length - 1];
  return new Date(last.date);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Pages "non versionnées" (home et waitlist) — date du jour comme
  // signal de fraîcheur conservateur (Next.js régénère le sitemap à
  // chaque déploiement, ce sera donc actualisé naturellement).
  const corePages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/liste-attente`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  // Pages footer Ressources & Légal lues depuis le registre central :
  // le `lastModified` reflète automatiquement la dernière mise à jour
  // éditoriale, ce qui aide les moteurs à recrawl quand on bump une
  // version (cf. effet du registre `page-versions.ts`).
  const footerPages: MetadataRoute.Sitemap = PAGE_VERSIONS.map((meta) => {
    const isLegal = meta.section === "legal";
    return {
      url: `${SITE_URL}${meta.href}`,
      lastModified: lastModifiedFor(meta),
      // Les pages légales bougent rarement (mise à jour éditoriale),
      // les pages ressources un peu plus (FAQ enrichie, etc.).
      changeFrequency: isLegal ? "yearly" : "monthly",
      // Les CGU/CGV/RGPD sont essentielles légalement → priorité un cran
      // au-dessus des pages "ressources" (aide, status, etc.).
      priority: isLegal ? 0.7 : 0.5,
    };
  });

  return [...corePages, ...footerPages];
}
