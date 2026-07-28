import type { Metadata } from "next";
import { Navbar, Footer } from "../_components/SiteChrome";
import HomeContactSection from "../_components/HomeContactSection";
import RequestDemoSection from "../_components/RequestDemoSection";
import { getAccessButtonsEnabled } from "@/lib/app-config/access";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Une question sur BUUPP ? Écrivez-nous ou réservez une démo de 30 minutes. Professionnels comme particuliers, une vraie personne vous répond.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const accessOpen = await getAccessButtonsEnabled();
  return (
    <div className="page" style={{ background: "var(--ivory)" }}>
      <Navbar accessOpen={accessOpen} />
      <HomeContactSection />
      <RequestDemoSection />
      <Footer />
    </div>
  );
}
