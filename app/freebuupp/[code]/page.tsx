import type { Metadata } from "next";
import Link from "next/link";
import FreebuuppDetailClient from "./FreebuuppDetailClient";

export const metadata: Metadata = {
  title: "FREEBUUPP — Détail du tirage | BUUPP",
  description: "Détail d'un tirage au sort FREEBUUPP : participants, gagnants et vérification du tirage.",
};

export default async function FreebuuppDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <div className="page" style={{ background: "var(--ivory)", paddingBottom: 96 }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(40px, 7vw, 64px) 24px 24px" }}>
        <Link href="/freebuupp" aria-label="Retour au mur FREEBUUPP" style={{ display: "inline-block", marginBottom: 24, color: "var(--ink-3)", textDecoration: "none" }}>
          ← Tous les FREEBUUPP
        </Link>
        <FreebuuppDetailClient code={code} />
      </div>
    </div>
  );
}
