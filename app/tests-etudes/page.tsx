import type { Metadata } from "next";
import StudiesList from "./_components/StudiesList";

export const metadata: Metadata = {
  title: "Tests & Études — participations rémunérées",
  description:
    "Sondages, tests de sites et d'applis, visites en magasin : donnez votre avis aux professionnels et soyez rémunéré sur votre portefeuille BUUPP.",
  alternates: { canonical: "/tests-etudes" },
};

export default function TestsEtudesPage() {
  return <StudiesList />;
}
