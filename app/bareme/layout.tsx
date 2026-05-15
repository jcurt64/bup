import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Barème des paliers",
  description:
    "Grille de valorisation des données personnelles par catégorie : 5 paliers de rémunération prospect, du palier 1 (identification) au palier 5 (patrimoine et projets).",
  alternates: { canonical: "/bareme" },
  openGraph: {
    title: "Barème des paliers — BUUPP",
    description:
      "Combien valent vos données ? Grille de valorisation par palier sur BUUPP.",
    url: "/bareme",
    type: "website",
  },
};

export default function BaremeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
