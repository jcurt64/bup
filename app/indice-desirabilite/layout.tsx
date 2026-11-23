import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Indice de désirabilité",
  description:
    "Comment se calcule le BUUPP Score : complétude des coordonnées, fraîcheur des informations et taux de fiabilité.",
  alternates: { canonical: "/indice-desirabilite" },
  openGraph: {
    title: "Indice de désirabilité — BUUPP",
    description:
      "Le BUUPP Score expliqué : coordonnées, fraîcheur des données et fiabilité.",
    url: "/indice-desirabilite",
    type: "website",
  },
};

export default function IndiceDesirabiliteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
