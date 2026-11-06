import type { Metadata } from "next";
import StudiesList from "./_components/StudiesList";

export const metadata: Metadata = {
  title: "Tests & Études — participations rémunérées",
  description:
    "Sondages, tests de sites et d'applis, visites en magasin : donnez votre avis aux professionnels et soyez rémunéré sur votre portefeuille BUUPP.",
  alternates: { canonical: "/tests-etudes" },
};

export default function TestsEtudesPage() {
  return (
    <>
      <div className="mono caps" style={{ color: "var(--ink-4)", marginBottom: 12 }}>Tests &amp; Études</div>
      <h1 className="serif" style={{ fontSize: "clamp(34px, 6vw, 56px)", lineHeight: 1.05, marginBottom: 14 }}>
        Donnez votre avis, soyez rémunéré
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--ink-3)", maxWidth: 720, marginBottom: 28 }}>
        Des professionnels cherchent des participants pour un sondage, le test de leur site ou de leur appli,
        ou une visite en magasin. Chaque campagne n&apos;est lancée que si assez de participants s&apos;inscrivent :
        vous êtes payé une fois la tâche réalisée et validée. Seuls votre prénom et un alias e-mail sont transmis.
      </p>
      <StudiesList />
    </>
  );
}
