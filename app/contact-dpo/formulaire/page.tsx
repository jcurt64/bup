import type { Metadata } from "next";
import Link from "next/link";
import BackHomeButton from "../../_components/BackHomeButton";
import ContactDpoForm from "../_components/ContactDpoForm";

export const metadata: Metadata = {
  title: "Formulaire de demande au DPO — BUUPP",
  description:
    "Formulaire en ligne pour adresser une demande RGPD (accès, rectification, effacement, opposition, portabilité) au Chargé à la protection des données de BUUPP.",
  robots: { index: true, follow: true },
};

export default function DpoFormulairePage() {
  return (
    <div
      className="page"
      style={{ background: "var(--ivory)", paddingBottom: 96 }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "clamp(40px, 7vw, 64px) 24px 24px",
        }}
      >
        <Link
          href="/"
          aria-label="Retour à l'accueil BUUPP"
          style={{ display: "inline-block", marginBottom: 32, lineHeight: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="BUUPP"
            style={{ height: 44, width: "auto", display: "block" }}
          />
        </Link>

        <div
          className="mono caps"
          style={{ color: "var(--ink-4)", marginBottom: 14 }}
        >
          Formulaire DPO
        </div>

        <h1
          className="serif"
          style={{
            fontSize: "clamp(32px, 5.5vw, 56px)",
            lineHeight: 1.05,
            marginBottom: 18,
            letterSpacing: "-0.02em",
          }}
        >
          Adresser une demande au DPO
        </h1>

        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--ink-3)",
            maxWidth: 720,
            marginBottom: 16,
          }}
        >
          Utilisez ce formulaire pour transmettre votre demande au
          Chargé à la protection des données de BUUPP. Un accusé de
          réception est envoyé immédiatement à l&apos;adresse renseignée
          ci-dessous&nbsp;; une réponse motivée vous est adressée dans un
          délai d&apos;<strong>un mois</strong> à compter de la réception
          (prolongeable de deux mois pour les demandes complexes,
          conformément à l&apos;article&nbsp;12.3 du RGPD).
        </p>

        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "var(--ink-4)",
            maxWidth: 720,
            marginBottom: 28,
          }}
        >
          Avant de remplir le formulaire, vous pouvez consulter la page{" "}
          <Link
            href="/contact-dpo"
            style={{
              color: "var(--accent)",
              textDecoration: "underline",
            }}
          >
            Contact DPO
          </Link>{" "}
          pour les détails sur la nature des droits (accès, rectification,
          effacement, opposition…), les pièces justificatives requises
          pour les demandes sensibles, et les voies de recours auprès
          de la CNIL.
        </p>
      </div>

      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <ContactDpoForm />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: "20px 16px",
            background: "var(--paper)",
            border: "1px dashed var(--line-2)",
            borderRadius: 10,
            fontSize: 13,
            color: "var(--ink-3)",
            lineHeight: 1.55,
          }}
        >
          <div style={{ flex: "1 1 280px" }}>
            <strong style={{ color: "var(--ink-2)" }}>
              Vous préférez écrire directement&nbsp;?
            </strong>{" "}
            Adressez votre demande par courriel à{" "}
            <a
              href="mailto:dp.buupp@buupp.com"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              dp.buupp@buupp.com
            </a>{" "}
            ou par courrier postal&nbsp;:{" "}
            <em>
              Majelink — À l&apos;attention du DPO — 12 Impasse des
              Étriers, 64140 Lons
            </em>
            .
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
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
