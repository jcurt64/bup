/**
 * GET /api/page-versions — registre des pages légales et ressources avec
 * leur version courante (lue depuis app/_components/page-versions.ts,
 * source unique de vérité partagée web ⇄ mobile).
 *
 * Public (pas d'auth requise — ces infos sont déjà publiques côté pages).
 * Consommé par l'app mobile (écran "Mon compte" / drawer) pour afficher
 * « v1.3 · 18/05/2026 » à côté de chaque lien et rester synchro avec
 * le tableau Versionning du Centre d'aide.
 */

import { NextResponse } from "next/server";
import {
  PAGE_VERSIONS,
  getCurrentVersion,
} from "@/app/_components/page-versions";

export const runtime = "nodejs";

export async function GET() {
  const items = PAGE_VERSIONS.map((p) => {
    const v = getCurrentVersion(p.slug);
    return {
      slug: p.slug,
      href: p.href,
      title: p.title,
      section: p.section,
      version: v.version,
      date: v.date,
    };
  });
  return NextResponse.json(
    { items },
    {
      headers: {
        // Données quasi-statiques : on autorise un cache court navigateur/CDN.
        // Tag invalidé manuellement via revalidate si besoin.
        "cache-control": "public, max-age=60, s-maxage=300",
      },
    },
  );
}
