import type { Metadata } from "next";
import Link from "next/link";
import FreebuuppWallClient from "./FreebuuppWallClient";

export const metadata: Metadata = {
  title: "FREEBUUPP — Tirages au sort gratuits | BUUPP",
  description:
    "Participez gratuitement aux FREEBUUPP : des tirages au sort lancés par des professionnels pour faire gagner des produits et services. Tirage aléatoire vérifiable.",
};

export default function FreebuuppWallPage() {
  return (
    <div className="page" style={{ background: "var(--ivory)", paddingBottom: 96 }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "clamp(40px, 7vw, 64px) 24px 24px" }}>
        <Link
          href="/"
          aria-label="Retour à l'accueil BUUPP"
          style={{ display: "inline-block", marginBottom: 32, lineHeight: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="BUUPP" style={{ height: 44, width: "auto", display: "block" }} />
        </Link>
        <div className="mono caps" style={{ color: "var(--ink-4)", marginBottom: 14 }}>
          FREEBUUPP
        </div>
        <h1 className="serif" style={{ fontSize: "clamp(28px, 5vw, 44px)", margin: "0 0 12px" }}>
          Le mur des tirages au sort
        </h1>
        <p style={{ color: "var(--ink-3)", maxWidth: 620, margin: "0 0 32px" }}>
          Des professionnels mettent en jeu des produits et services. Vous vous inscrivez
          gratuitement, et un tirage au sort <strong>vérifiable</strong> désigne les gagnants.
          Chaque participant reçoit un numéro — c&apos;est ce numéro qui est tiré.
        </p>
        <FreebuuppWallClient />
      </div>
    </div>
  );
}
