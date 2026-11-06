import { notFound } from "next/navigation";
import { Navbar, Footer } from "../_components/SiteChrome";
import { getAccessButtonsEnabled } from "@/lib/app-config/access";
import { getStudiesEnabled } from "@/lib/studies/flag";

export default async function TestsEtudesLayout({ children }: { children: React.ReactNode }) {
  const [studiesOpen, accessOpen] = await Promise.all([getStudiesEnabled(), getAccessButtonsEnabled()]);
  if (!studiesOpen) notFound();
  return (
    <div className="page" style={{ background: "var(--ivory)" }}>
      <Navbar accessOpen={accessOpen} studiesOpen />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(96px, 12vw, 128px) 16px 80px" }}>{children}</main>
      <Footer studiesOpen />
    </div>
  );
}
