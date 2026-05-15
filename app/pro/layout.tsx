/**
 * Layout de l'espace professionnel — uniquement pour exporter une
 * `metadata` `noindex/nofollow`. L'espace est gardé par auth Clerk +
 * middleware, mais on ajoute un signal explicite pour les bots.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Espace pro",
  robots: { index: false, follow: false, nocache: true },
};

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return children;
}
