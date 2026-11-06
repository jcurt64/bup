import { notFound } from "next/navigation";
import { Navbar, Footer } from "../_components/SiteChrome";
import { getAccessButtonsEnabled } from "@/lib/app-config/access";
import { getStudiesEnabled } from "@/lib/studies/flag";
import "./studies.css";

export default async function TestsEtudesLayout({ children }: { children: React.ReactNode }) {
  const [studiesOpen, accessOpen] = await Promise.all([getStudiesEnabled(), getAccessButtonsEnabled()]);
  if (!studiesOpen) notFound();
  return (
    <div className="page" style={{ background: "var(--ivory)" }}>
      <Navbar accessOpen={accessOpen} studiesOpen />
      <main>{children}</main>
      <Footer studiesOpen />
    </div>
  );
}
