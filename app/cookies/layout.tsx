import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique des cookies",
  description:
    "Liste exhaustive des cookies utilisés sur BUUPP : essentiels (session Clerk), préférences, statistiques anonymisées, marketing après opt-in. Émetteurs, finalités et durées.",
  alternates: { canonical: "/cookies" },
  openGraph: {
    title: "Politique des cookies — BUUPP",
    description:
      "Cookies utilisés sur BUUPP : type, finalité, durée et mode de gestion.",
    url: "/cookies",
    type: "article",
  },
};

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
