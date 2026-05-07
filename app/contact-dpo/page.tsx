import type { Metadata } from "next";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";

export const metadata: Metadata = {
  title: "Contact DPO — BUUPP",
  description:
    "Coordonnées du Délégué à la protection des données (DPO) de BUUPP et exercice de vos droits RGPD.",
};

export default function ContactDpoPage() {
  return (
    <div className="page" style={{ background: "var(--ivory)", paddingBottom: 96 }}>
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
          Contact DPO
        </div>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            lineHeight: 1.05,
            marginBottom: 18,
          }}
        >
          Délégué à la protection des données
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--ink-3)",
            maxWidth: 680,
          }}
        >
          BUUPP a désigné un Délégué à la protection des données (DPO),
          interlocuteur privilégié pour toute question relative à la
          confidentialité, à la sécurité de vos informations ou à
          l&apos;exercice de vos droits RGPD.
        </p>
      </div>

      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <Section title="1. Coordonnées du DPO">
          <p>
            <em>
              À compléter : nom du DPO, email dédié, adresse postale Majelink
              (12 Impasse des Étriers, 64140 Lons), formulaire en ligne
              éventuel.
            </em>
          </p>
        </Section>

        <Section title="2. Quand nous contacter ?">
          <p>
            <em>
              À compléter : exemples de motifs (suppression de compte, accès
              à vos données, rectification d&apos;un palier, opposition au
              traitement marketing, signalement d&apos;une fuite supposée,
              etc.).
            </em>
          </p>
        </Section>

        <Section title="3. Vos droits RGPD">
          <p>
            <em>
              À compléter : droit d&apos;accès, de rectification,
              d&apos;effacement, d&apos;opposition, de limitation, de
              portabilité, et de directives post-mortem.
            </em>{" "}
            Pour le détail, voir notre{" "}
            <Link
              href="/rgpd"
              style={{
                color: "var(--accent)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              politique RGPD
            </Link>
            .
          </p>
        </Section>

        <Section title="4. Pièces à fournir">
          <p>
            <em>
              À compléter : justificatif d&apos;identité demandé pour les
              demandes sensibles (accès / effacement), formulaire de
              vérification, modèles de courrier.
            </em>
          </p>
        </Section>

        <Section title="5. Délai de réponse">
          <p>
            <em>
              À compléter : engagement de réponse sous 30 jours conformément
              au RGPD, prolongation possible de 60 jours pour les demandes
              complexes (avec notification).
            </em>
          </p>
        </Section>

        <Section title="6. Recours auprès de la CNIL">
          <p>
            Si la réponse apportée par le DPO ne vous satisfait pas, vous
            pouvez à tout moment introduire une réclamation auprès de la
            Commission Nationale de l&apos;Informatique et des Libertés —{" "}
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--accent)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              cnil.fr
            </a>
            .
          </p>
        </Section>

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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className="serif"
        style={{
          fontSize: "clamp(22px, 3vw, 28px)",
          lineHeight: 1.2,
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--ink-3)",
        }}
      >
        {children}
      </div>
    </section>
  );
}
