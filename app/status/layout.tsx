import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Statut de la plateforme",
  description:
    "Disponibilité en temps réel des services BUUPP : authentification, paiements Stripe, base de données Supabase, e-mail. Historique des incidents.",
  alternates: { canonical: "/status" },
  openGraph: {
    title: "Statut de la plateforme — BUUPP",
    description: "Disponibilité en temps réel des services BUUPP.",
    url: "/status",
    type: "website",
  },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
