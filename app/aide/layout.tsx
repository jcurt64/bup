import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Centre d'aide",
  description:
    "Toutes les réponses à vos questions sur BUUPP : profils prospects, plans pros, paliers de données, retraits IBAN, sécurité et RGPD. Versionning des pages publiques.",
  alternates: { canonical: "/aide" },
  openGraph: {
    title: "Centre d'aide — BUUPP",
    description:
      "Toutes les réponses à vos questions sur BUUPP : prospects, pros, paliers, retraits, sécurité et RGPD.",
    url: "/aide",
    type: "website",
  },
};

export default function AideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
