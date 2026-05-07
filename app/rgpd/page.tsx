import type { Metadata } from "next";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";

export const metadata: Metadata = {
  title: "Politique RGPD — BUUPP",
  description:
    "Politique de protection des données personnelles et information cookies de BUUPP.",
};

export default function RgpdPage() {
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
          aria-label="Retour à l’accueil BUUPP"
          style={{
            display: "inline-block",
            marginBottom: 32,
            lineHeight: 0,
          }}
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
          Politique de confidentialité
        </div>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            lineHeight: 1.05,
            marginBottom: 18,
          }}
        >
          Protection de vos données personnelles
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--ink-3)",
            maxWidth: 680,
          }}
        >
          BUUPP s’engage à protéger la confidentialité de vos données. Cette
          page décrit les traitements effectués sur vos données personnelles,
          vos droits, et l’usage des cookies sur le site.
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
        <Section title="1. Responsable de traitement">
          <p>
            Majelink — 12 Impasse des Étriers, 64140 Lons — RCS Pau 892 514
            167. Délégué à la protection des données : <em>à compléter</em>.
          </p>
        </Section>

        <Section title="2. Données collectées">
          <p><em>À compléter : nature des données collectées par finalité.</em></p>
        </Section>

        <Section title="3. Finalités du traitement">
          <p><em>À compléter : usages des données (gestion de compte, mise en relation, etc.).</em></p>
        </Section>

        <Section title="4. Bases légales">
          <p><em>À compléter : consentement, exécution contractuelle, intérêt légitime, obligation légale.</em></p>
        </Section>

        <Section title="5. Durée de conservation">
          <p><em>À compléter : durée par catégorie de données.</em></p>
        </Section>

        <Section title="6. Destinataires">
          <p><em>À compléter : sous-traitants, hébergeur, services tiers.</em></p>
        </Section>

        <Section title="7. Vos droits">
          <p>
            Vous disposez des droits d’accès, de rectification, d’effacement,
            d’opposition, de limitation et de portabilité, ainsi que du droit
            de définir des directives post-mortem. Pour les exercer :{" "}
            <em>contact à compléter</em>. Vous pouvez également déposer une
            réclamation auprès de la CNIL (cnil.fr).
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            Le site utilise des cookies essentiels, de préférences, de
            statistiques et de marketing. Vous pouvez gérer vos choix à tout
            moment via le bouton flottant <em>Gérer les cookies</em> en bas à
            gauche de l’écran. Le détail complet (nom, émetteur, finalité,
            durée) ainsi que les modalités de refus et de suppression sont
            décrits dans notre{" "}
            <Link
              href="/cookies"
              style={{
                color: "var(--accent)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              politique des cookies
            </Link>
            .
          </p>
        </Section>

        <Section title="9. Modifications">
          <p>
            La présente politique peut être mise à jour. La date de dernière
            modification est indiquée ci-dessous : <em>à compléter</em>.
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
