import type { Metadata } from "next";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — BUUPP",
  description:
    "Conditions Générales d'Utilisation de la plateforme BUUPP (prospects et professionnels).",
};

export default function CguPage() {
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
          Conditions générales d&apos;utilisation
        </div>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            lineHeight: 1.05,
            marginBottom: 18,
          }}
        >
          Vos engagements et les nôtres
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--ink-3)",
            maxWidth: 680,
          }}
        >
          BUUPP est une plateforme de mise en relation rémunérée entre
          particuliers (prospects) et professionnels, opérée par la société
          Majelink. Les présentes CGU encadrent l&apos;accès au service et
          précisent les droits et obligations de chacun.
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
        <Section title="1. Objet">
          <p>
            <em>
              À compléter : objet du contrat, périmètre du service, accès
              gratuit côté prospect.
            </em>
          </p>
        </Section>

        <Section title="2. Acceptation des CGU">
          <p>
            <em>
              À compléter : modalités d&apos;acceptation à l&apos;inscription,
              opposabilité, version applicable.
            </em>
          </p>
        </Section>

        <Section title="3. Description du service">
          <p>
            <em>
              À compléter : double consentement, paliers de données, BUUPP
              Score, mise en relation, BUUPP Coins.
            </em>
          </p>
        </Section>

        <Section title="4. Inscription et compte utilisateur">
          <p>
            <em>
              À compléter : création de compte (Clerk), unicité du compte,
              vérification téléphone, sécurité des accès, suppression du
              compte.
            </em>
          </p>
        </Section>

        <Section title="5. Engagements du prospect">
          <p>
            <em>
              À compléter : exactitude des données, interdiction des comptes
              multiples (RIB et téléphone uniques), respect du double
              consentement, signalement des dérives.
            </em>
          </p>
        </Section>

        <Section title="6. Engagements du professionnel">
          <p>
            <em>
              À compléter : usage des coordonnées révélées (one-shot par
              prospect), interdiction d&apos;exfiltration, watermarking,
              respect des paliers ciblés, conformité RGPD.
            </em>
          </p>
        </Section>

        <Section title="7. Double consentement et mise en relation">
          <p>
            <em>
              À compléter : règle des deux accords explicites, fenêtre de
              réponse, expiration et clôture de campagne, refus / retour
              arrière.
            </em>
          </p>
        </Section>

        <Section title="8. BUUPP Coins, gains et retraits">
          <p>
            <em>
              À compléter : valeur des BUUPP Coins, séquestre, déblocage à la
              clôture de campagne, seuil minimum de retrait, modes
              disponibles, fiscalité.
            </em>
          </p>
        </Section>

        <Section title="9. Propriété intellectuelle">
          <p>
            <em>
              À compléter : marque BUUPP, contenus de la plateforme, licence
              limitée d&apos;usage.
            </em>
          </p>
        </Section>

        <Section title="10. Données personnelles">
          <p>
            Le traitement des données personnelles est détaillé dans la{" "}
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

        <Section title="11. Disponibilité du service et évolutions">
          <p>
            <em>
              À compléter : maintenance, indisponibilités, évolutions
              fonctionnelles, prise d&apos;effet des modifications.
            </em>
          </p>
        </Section>

        <Section title="12. Suspension et résiliation">
          <p>
            <em>
              À compléter : motifs de suspension (fraude, doublon,
              comportement abusif), procédure de résiliation côté utilisateur
              et côté BUUPP.
            </em>
          </p>
        </Section>

        <Section title="13. Responsabilité">
          <p>
            <em>
              À compléter : limites de responsabilité, force majeure, contenus
              tiers, exclusions.
            </em>
          </p>
        </Section>

        <Section title="14. Loi applicable et juridiction">
          <p>
            <em>
              À compléter : droit français, juridiction compétente, médiation
              de la consommation.
            </em>
          </p>
        </Section>

        <Section title="Programme Parrain — Fondateur·ice">
          <p>
            Les termes <strong>«&nbsp;parrain·e&nbsp;»</strong> et{" "}
            <strong>«&nbsp;fondateur·ice&nbsp;»</strong> désignent
            indifféremment la même qualité&nbsp;: toute personne s&apos;étant
            inscrite sur la liste d&apos;attente avant la date officielle de
            lancement de BUUPP. Ce statut, permanent, est confirmé à la
            création du compte et ouvre droit à&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              une <strong>priorité de 10 minutes</strong> sur les sollicitations
              «&nbsp;flash deal&nbsp;» (visibles aux parrain·es / fondateur·ices
              avant le grand public)&nbsp;;
            </li>
            <li>
              un <strong>doublement de la récompense</strong> versée pour chaque
              sollicitation acceptée pendant le{" "}
              <strong>1er mois suivant le lancement officiel</strong>, sauf
              indication contraire du professionnel à l&apos;origine de la
              sollicitation&nbsp;;
            </li>
            <li>
              un <strong>code de parrainage personnel</strong> permettant
              d&apos;inviter jusqu&apos;à <strong>10&nbsp;filleul·es</strong>{" "}
              maximum sur la liste d&apos;attente. Au-delà, le lien n&apos;est
              plus utilisable et tout nouvel inscrit utilisant ce code reçoit
              le message «&nbsp;Nombre maximal de filleul·es déjà
              atteint&nbsp;».
            </li>
          </ul>
          <p>
            <strong>Palier VIP au plafond de 10 filleul·es.</strong> Lorsqu&apos;un
            parrain·e atteint le plafond de 10&nbsp;filleul·es inscrit·es sur la
            liste d&apos;attente, il/elle accède à un palier VIP&nbsp;: chaque
            sollicitation acceptée pendant le 1er mois suivant le lancement
            donne droit à un bonus exceptionnel <strong>forfaitaire de
            +5,00&nbsp;€</strong>, en lieu et place du doublement standard. Ce
            bonus n&apos;est appliqué que sur les campagnes dont le budget
            total dépasse <strong>300,00&nbsp;€</strong>&nbsp;; en deçà, le
            doublement standard (×2) demeure applicable.
          </p>
          <p>
            Aucune action n&apos;est requise de la part du parrain·e /
            fondateur·ice&nbsp;: le bénéfice (×2 standard ou +5&nbsp;€ VIP) est
            calculé automatiquement à l&apos;acceptation et notifié par
            courriel.
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
