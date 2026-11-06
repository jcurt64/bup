import Image from "next/image";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";
import PageVersion from "../_components/PageVersion";
import DesirabiliteContent from "../_components/DesirabiliteContent";

/**
 * /indice-desirabilite — le BUUPP Score expliqué (page du footer
 * « Ressources »). Les trois volets du calcul (paliers, fraîcheur,
 * fiabilité) sont empilés en sections distinctes, sans scène épinglée.
 */
export default function IndiceDesirabilitePage() {
  return (
    <div className="page" style={{ background: "var(--ivory)", paddingBottom: 96 }}>
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "clamp(40px, 7vw, 64px) 24px 0",
        }}
      >
        <Link
          href="/"
          aria-label="Retour à l'accueil BUUPP"
          style={{ display: "inline-block", marginBottom: 32, lineHeight: 0 }}
        >
          <Image
            src="/logo.png"
            alt="BUUPP"
            width={800}
            height={295}
            style={{ height: 44, width: "auto", display: "block" }}
          />
        </Link>
        <div className="mono caps" style={{ color: "var(--ink-4)", marginBottom: 14 }}>
          Ressources
        </div>
        <PageVersion page="indice-desirabilite" />
        <h1
          className="serif"
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            lineHeight: 1.05,
            marginBottom: 18,
          }}
        >
          Indice de désirabilité
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--ink-3)",
            maxWidth: 680,
          }}
        >
          Le BUUPP Score mesure, sur 1000, l&apos;intérêt de votre profil pour
          les professionnels. Il repose sur trois éléments, détaillés
          ci-dessous : la complétude de vos paliers de données, la fraîcheur
          de vos informations et votre taux de fiabilité.
        </p>
      </div>

      <DesirabiliteContent />

      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            marginTop: 8,
            paddingTop: 28,
            borderTop: "1px solid var(--line)",
          }}
        >
          <BackHomeButton />
        </div>
      </div>
    </div>
  );
}
