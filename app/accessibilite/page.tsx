import type { Metadata } from "next";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";
import PageVersion from "../_components/PageVersion";

export const metadata: Metadata = {
  title: "Accessibilité — BUUPP",
  description:
    "Déclaration d'accessibilité de BUUPP, exploitée par Majelink. État de conformité au RGAA, contacts, signalement et voies de recours.",
};

export default function AccessibilitePage() {
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
          Accessibilité — non conforme (audit en cours)
        </div>
        <PageVersion page="accessibilite" />
        <h1
          className="serif"
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            lineHeight: 1.05,
            marginBottom: 18,
          }}
        >
          Déclaration d&apos;accessibilité
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--ink-3)",
            maxWidth: 680,
          }}
        >
          BUUPP est une plateforme de mise en relation à double consentement
          entre prospects et professionnels, éditée par la société Majelink.
          La présente déclaration s&apos;applique à l&apos;ensemble du site{" "}
          <strong>buupp.com</strong> ainsi qu&apos;aux espaces connectés
          prospect et professionnel.
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
        <Section title="1. Qu'est-ce que l'accessibilité numérique ?">
          <p>
            L&apos;accessibilité numérique consiste à rendre les sites web,
            applications mobiles et services en ligne utilisables par toutes
            les personnes, y compris celles en situation de handicap —
            handicaps moteurs, visuels, auditifs, cognitifs ou psychiques,
            qu&apos;ils soient permanents ou temporaires. Concrètement, cela
            signifie que le contenu doit être <em>perceptible</em>,{" "}
            <em>utilisable</em>, <em>compréhensible</em> et{" "}
            <em>compatible</em> avec les technologies d&apos;assistance
            (lecteurs d&apos;écran, plages braille, agrandisseurs, commandes
            vocales, navigation au clavier, etc.).
          </p>
        </Section>

        <Section title="2. Notre engagement">
          <p>
            Majelink, éditeur de BUUPP, considère l&apos;accessibilité comme
            une préoccupation continue, intégrée dès la conception des
            interfaces. Notre objectif est de permettre à chaque prospect et
            chaque professionnel d&apos;utiliser pleinement la plateforme,
            quelles que soient ses capacités : compléter ses paliers de
            données, accepter ou refuser une sollicitation, lancer une
            campagne, gérer ses retraits ou encore exercer ses droits
            RGPD&nbsp;— autant d&apos;actions critiques qui doivent rester
            accessibles à tous.
          </p>
        </Section>

        <Section title="3. Cadre réglementaire">
          <p>
            Cette déclaration s&apos;inscrit dans le cadre de la{" "}
            <strong>Directive européenne 2016/2102</strong> du 26 octobre
            2016 relative à l&apos;accessibilité des sites web et
            applications mobiles, transposée en droit français par
            l&apos;article 47 de la loi n° 2005-102 du 11 février 2005 (pour
            l&apos;égalité des droits et des chances) et le décret n°
            2019-768 du 24 juillet 2019.
          </p>
          <p style={{ marginTop: 10 }}>
            Le référentiel applicable est le{" "}
            <strong>Référentiel Général d&apos;Amélioration de
            l&apos;Accessibilité (RGAA)</strong>, version en vigueur,
            transposition française des règles internationales{" "}
            <strong>WCAG 2.1 niveau AA</strong>.
          </p>
        </Section>

        <Section title="4. État de conformité">
          <p>
            <strong>BUUPP est actuellement non conforme</strong> au RGAA.
            Aucun audit de conformité formel n&apos;a encore été réalisé : la
            plateforme est récente et nous concentrons d&apos;abord nos
            efforts sur la mise en accessibilité des parcours critiques
            (inscription, vérification SMS, gestion des paliers, acceptation
            d&apos;une mise en relation, lancement d&apos;une campagne,
            retrait IBAN).
          </p>
          <p style={{ marginTop: 10 }}>
            Un audit RGAA externe est planifié dès que les parcours
            précités seront stabilisés. Cette déclaration sera alors
            actualisée avec le pourcentage de conformité réel et la liste
            des critères non respectés.
          </p>
        </Section>

        <Section title="5. Périmètre couvert et technologies évaluées">
          <p>
            La présente déclaration s&apos;applique aux écrans suivants :
          </p>
          <ul>
            <li>
              Pages publiques : <em>accueil</em>, barème des paliers, pages
              légales (CGU, CGV, RGPD, cookies, contact DPO).
            </li>
            <li>
              Espace prospect (connecté) : portefeuille, mises en relation,
              mes données, vérification téléphone, parrainage, BUUPP Score,
              fiscal, préférences.
            </li>
            <li>
              Espace professionnel (connecté) : vue d&apos;ensemble,
              création de campagne, gestion des contacts, analytics,
              facturation, mes informations.
            </li>
          </ul>
          <p style={{ marginTop: 10 }}>
            Les tests sont conduits sur les technologies suivantes :
            navigateurs Chrome, Firefox, Safari et Edge dans leurs deux
            dernières versions majeures, lecteurs d&apos;écran NVDA et
            VoiceOver, et navigation clavier seul.
          </p>
        </Section>

        <Section title="6. Contenus non accessibles connus">
          <p>
            Les limitations identifiées à ce jour, qui feront
            l&apos;objet d&apos;un plan de remédiation prioritaire&nbsp;:
          </p>
          <ul>
            <li>
              <strong>Tableaux de bord prospect et professionnel</strong>{" "}
              — certains widgets (graphiques de score, marquee « live » de
              la home) ne disposent pas encore d&apos;équivalent textuel
              ou de lecture séquentielle pour les lecteurs d&apos;écran.
            </li>
            <li>
              <strong>Modales (saisie RIB, vérification téléphone,
              retrait, création de campagne)</strong> — la gestion du focus
              clavier et l&apos;annonce du titre ne sont pas encore
              parfaitement systématisées.
            </li>
            <li>
              <strong>Composants couleur / contraste</strong> — quelques
              libellés en gris clair sur fond ivoire peuvent être
              en-dessous du ratio recommandé (WCAG 1.4.3, 4,5:1).
            </li>
            <li>
              <strong>Documents PDF générés</strong> (factures
              professionnelles, justificatifs fiscaux) — la balisation
              accessible n&apos;est pas encore intégrée à la chaîne de
              génération.
            </li>
          </ul>
          <p style={{ marginTop: 10 }}>
            Les emails transactionnels (sollicitation, encaissement,
            rappel) sont déjà servis avec des structures HTML de tables
            sémantiques, des contrastes élevés et des libellés alternatifs
            sur les images.
          </p>
        </Section>

        <Section title="7. Tester et nous signaler une difficulté">
          <p>
            Si vous rencontrez une difficulté ou un défaut
            d&apos;accessibilité empêchant de finaliser une action sur
            BUUPP (par exemple : impossibilité de valider un palier au
            clavier, contraste insuffisant pour lire un montant, blocage
            d&apos;un lecteur d&apos;écran sur une modale), nous nous
            engageons à&nbsp;:
          </p>
          <ul>
            <li>
              vous répondre dans un délai raisonnable&nbsp;;
            </li>
            <li>
              corriger le défaut dans la mesure du possible&nbsp;;
            </li>
            <li>
              ou, à défaut, vous transmettre l&apos;information demandée
              dans un format adapté (écrit, courriel, entretien
              téléphonique).
            </li>
          </ul>
          <p style={{ marginTop: 10 }}>
            Pour signaler une difficulté ou demander une mise en
            accessibilité, contactez notre référent accessibilité via la
            page{" "}
            <Link
              href="/contact-dpo"
              style={{
                color: "var(--accent)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              Contact DPO
            </Link>{" "}
            (interlocuteur unique pour l&apos;accessibilité et la
            protection des données chez Majelink).
          </p>
        </Section>

        <Section title="8. Voies de recours">
          <p>
            Si vous constatez un défaut d&apos;accessibilité vous
            empêchant d&apos;accéder à un contenu ou à un service de la
            plateforme, et que vous n&apos;obtenez pas de réponse
            satisfaisante de la part de l&apos;éditeur, vous pouvez saisir
            le <strong>Défenseur des droits</strong> par l&apos;une des
            voies suivantes&nbsp;:
          </p>
          <ul>
            <li>
              Formulaire de saisine en ligne&nbsp;:{" "}
              <a
                href="https://www.defenseurdesdroits.fr/saisir/formulaire"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--accent)",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                defenseurdesdroits.fr/saisir/formulaire
              </a>
            </li>
            <li>
              Coordonnées des délégués régionaux&nbsp;:{" "}
              <a
                href="https://www.defenseurdesdroits.fr/saisir/delegues"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--accent)",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                defenseurdesdroits.fr/saisir/delegues
              </a>
            </li>
            <li>
              Par courrier postal&nbsp;:{" "}
              <span style={{ color: "var(--ink)" }}>
                Défenseur des droits — Libre réponse 71120 — 75342 Paris
                CEDEX 07
              </span>{" "}
              (envoi gratuit, sans timbre).
            </li>
          </ul>
        </Section>

        <Section title="9. Établissement de cette déclaration">
          <p>
            La présente déclaration a été établie le <em>à compléter</em>{" "}
            par Majelink (12 Impasse des Étriers, 64140 Lons — RCS Pau 892
            514 167), éditeur de BUUPP.
          </p>
          <p style={{ marginTop: 10 }}>
            Elle fera l&apos;objet d&apos;une mise à jour annuelle, ou à
            chaque évolution majeure du périmètre couvert ou des
            résultats d&apos;audit.
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
          textAlign: "justify",
          hyphens: "auto",
        }}
      >
        {children}
      </div>
    </section>
  );
}
