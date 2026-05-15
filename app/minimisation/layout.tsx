import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Minimisation des données",
  description:
    "Comment BUUPP applique le principe RGPD de minimisation : ne demander et ne stocker que le strict nécessaire à chaque palier. Détail palier par palier.",
  alternates: { canonical: "/minimisation" },
  openGraph: {
    title: "Minimisation des données — BUUPP",
    description:
      "Application du principe RGPD de minimisation sur BUUPP, palier par palier.",
    url: "/minimisation",
    type: "article",
  },
};

export default function MinimisationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
