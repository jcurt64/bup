/**
 * Layout de l'espace prospect — uniquement pour exporter une `metadata`
 * `noindex/nofollow`. L'espace est gardé par auth Clerk + middleware,
 * mais on ajoute un signal explicite pour les bots qui suivraient un
 * lien fuité (ex. capture d'écran indexée par accident).
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Espace prospect",
  robots: { index: false, follow: false, nocache: true },
};

export default function ProspectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
