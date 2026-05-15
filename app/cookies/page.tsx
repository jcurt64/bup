"use client";

import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";
import PageVersion from "../_components/PageVersion";
import {
  COOKIE_CATEGORIES,
  type CookieCategory,
  type CookieEntry,
} from "../_components/cookie-data";

export default function CookiesPage() {
  const openPanel = () => {
    try {
      window.dispatchEvent(new Event("bupp:open-cookie-modal"));
    } catch {
      /* no-op (SSR / vieux navigateurs) */
    }
  };

  return (
    <div className="page" style={{ background: "var(--ivory)", paddingBottom: 96 }}>
      <div
        style={{
          maxWidth: 920,
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
        <div className="mono caps" style={{ color: "var(--ink-4)", marginBottom: 14 }}>
          Politique des cookies
        </div>
        <PageVersion page="cookies" />
        <h1
          className="serif"
          style={{ fontSize: "clamp(36px, 6vw, 64px)", lineHeight: 1.05, marginBottom: 18 }}
        >
          Cookies utilisés sur BUUPP
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--ink-3)", maxWidth: 720 }}>
          BUUPP utilise des cookies et traceurs équivalents pour assurer le
          fonctionnement de la plateforme, mémoriser vos préférences et,
          uniquement avec votre accord, mesurer l&apos;audience et améliorer
          le service. Cette page détaille la nature de chaque cookie déposé,
          sa finalité, sa durée et son émetteur.
        </p>

        <div className="row gap-3 wrap" style={{ marginTop: 24 }}>
          <button
            type="button"
            onClick={openPanel}
            className="back-home-btn"
            style={{ background: "var(--accent)" }}
          >
            <span aria-hidden style={{ fontSize: 14 }}>⚙</span>
            <span>Modifier mes préférences</span>
          </button>
        </div>
      </div>

      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <Section title="1. Qu'est-ce qu'un cookie ?">
          <p>
            Un cookie est un petit fichier texte déposé sur votre appareil
            (ordinateur, smartphone, tablette) lors de la visite d&apos;un
            site web. Il permet, pendant sa durée de validité, de reconnaître
            votre navigateur, de mémoriser certaines informations vous
            concernant (paramètres d&apos;affichage, préférences, état de
            connexion) et de mesurer l&apos;audience du site.
          </p>
        </Section>

        <Section title="2. Pourquoi BUUPP utilise-t-il des cookies ?">
          <p>
            BUUPP est une plateforme de mise en relation à double consentement
            entre prospects et professionnels. Les cookies nous servent à :
          </p>
          <ul>
            <li>
              <strong>Maintenir votre session</strong> — vous reconnaître
              entre deux pages du site sans avoir à vous reconnecter à chaque
              navigation (espace prospect, espace professionnel).
            </li>
            <li>
              <strong>Sécuriser les formulaires</strong> — vérification CSRF
              et protection anti-bot lors des actions sensibles (lancement
              d&apos;une campagne, retrait IBAN, mise à jour des paliers).
            </li>
            <li>
              <strong>Mémoriser vos préférences</strong> — langue
              d&apos;affichage et thème.
            </li>
            <li>
              <strong>Mesurer l&apos;usage du site</strong> — uniquement après
              consentement explicite, pour comprendre les pages les plus
              consultées et améliorer l&apos;expérience.
            </li>
            <li>
              <strong>Mesurer la performance des campagnes marketing</strong>{" "}
              — uniquement après consentement explicite, pour les pixels
              tiers (Meta, LinkedIn).
            </li>
          </ul>
        </Section>

        <Section title="3. Vos choix et leur durée">
          <p>
            À votre première visite, un bandeau vous permet d&apos;<strong>accepter
            tous les cookies</strong>, de les <strong>refuser</strong> (seuls
            les cookies essentiels resteront actifs) ou de{" "}
            <strong>personnaliser catégorie par catégorie</strong>. Votre
            choix est enregistré pendant <strong>13 mois</strong>{" "}
            (recommandation CNIL), au-delà desquels une nouvelle demande de
            consentement vous sera proposée.
          </p>
          <p style={{ marginTop: 10 }}>
            Vous pouvez à tout moment revoir vos choix en cliquant sur{" "}
            <button
              type="button"
              onClick={openPanel}
              style={{
                color: "var(--accent)",
                textDecoration: "underline",
                background: "none",
                border: 0,
                padding: 0,
                cursor: "pointer",
                font: "inherit",
              }}
            >
              « Modifier mes préférences »
            </button>{" "}
            ci-dessus, ou via le bouton flottant <strong>« Gérer les cookies »</strong>{" "}
            présent en bas à gauche de chaque page.
          </p>
        </Section>

        <Section title="4. Catégories de cookies déposés">
          <p>
            Le détail ci-dessous liste les cookies déposés sur votre appareil
            quand vous accédez à la plateforme. Pour chaque cookie : nom,
            émetteur, finalité, durée et type (interne BUUPP ou tiers).
          </p>
        </Section>

        {COOKIE_CATEGORIES.map((cat) => (
          <CategoryBlock key={cat.id} category={cat} />
        ))}

        <Section title="5. Pixels de suivi dans les emails BUUPP">
          <p>
            Un <strong>pixel de suivi</strong> est une image transparente de
            1×1 pixel incluse dans le HTML d&apos;un email. Quand votre client
            mail charge l&apos;image, notre serveur peut enregistrer que
            l&apos;email a été ouvert. BUUPP utilise ce mécanisme dans les{" "}
            <strong>broadcasts publiés depuis le back-office</strong>{" "}
            (informations produit, mises à jour CGU, communications de
            l&apos;équipe BUUPP), uniquement à fin de mesure d&apos;audience
            agrégée.
          </p>
          <p style={{ marginTop: 10 }}>
            <strong>Cadre légal applicable.</strong> La{" "}
            <a
              href="https://www.cnil.fr/fr/recommandation-pixel-suivi-courriels"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              recommandation CNIL n°&nbsp;2026-042 du 12 mars 2026
            </a>{" "}
            (publiée le 14 avril 2026) précise les conditions de licéité des
            pixels de suivi dans les courriels au regard de l&apos;article 82
            de la loi Informatique et Libertés. Le principe est le{" "}
            <strong>consentement préalable de la personne</strong>, sauf
            exemption strictement encadrée pour la mesure individuelle de la
            délivrabilité d&apos;emails transactionnels (alertes de compte,
            confirmations de commande, factures, rappels de mot de passe,
            alertes de sécurité). Les broadcasts BUUPP{" "}
            <em>ne relèvent pas</em> de cette exemption — ils nécessitent
            donc votre consentement.
          </p>
          <p style={{ marginTop: 10 }}>
            <strong>Mise en conformité en cours.</strong> Nous mettons
            actuellement en place le mécanisme de recueil du consentement
            prévu par la recommandation, dans le délai de transition de 3
            mois ouvert par la CNIL (échéance au 14 juillet 2026). Tant que
            ce mécanisme n&apos;est pas déployé, nous appliquons les mesures
            transitoires suivantes :
          </p>
          <ul>
            <li>
              <strong>Information à chaque envoi</strong> — un encart dans le
              pied de chaque broadcast vous informe de la présence du pixel
              et indique le moyen de vous y opposer.
            </li>
            <li>
              <strong>Opposition par simple demande</strong> — vous pouvez à
              tout moment écrire à notre{" "}
              <Link
                href="/contact-dpo"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                Chargé à la protection des données
              </Link>{" "}
              pour qu&apos;aucun pixel ne soit inséré dans les broadcasts qui
              vous seront adressés. L&apos;opposition est immédiate et
              définitive (sauf demande explicite de réactivation).
            </li>
            <li>
              <strong>Blocage côté client mail</strong> — toutes les
              messageries permettent de désactiver le chargement automatique
              des images (Gmail web, Outlook, Apple Mail, Thunderbird…). Un
              pixel non chargé n&apos;est pas comptabilisé.
            </li>
            <li>
              <strong>Lecture dans votre dashboard</strong> — la cloche de
              notifications et l&apos;onglet «&nbsp;Mes messages&nbsp;»
              affichent le même contenu sans pixel. Aucune mesure
              d&apos;ouverture n&apos;est faite côté application.
            </li>
          </ul>
          <p style={{ marginTop: 10 }}>
            <strong>Données collectées par le pixel.</strong> Strictement
            limitées : un identifiant opaque de destinataire (UUID généré au
            moment de l&apos;envoi, non énumérable), la date de première
            ouverture, et un compteur d&apos;ouvertures. Nous{" "}
            <strong>
              ne stockons ni adresse IP, ni user-agent, ni
              géolocalisation, ni fingerprint
            </strong>
            . Les statistiques ne sont consultables qu&apos;en agrégat dans
            le back-office BUUPP, jamais à l&apos;échelle d&apos;un
            destinataire identifié.
          </p>
          <p style={{ marginTop: 10 }}>
            <strong>Durée de conservation.</strong> 13 mois à compter de
            l&apos;envoi du broadcast, durée alignée sur la recommandation
            CNIL relative aux traceurs.
          </p>
          <p style={{ marginTop: 10 }}>
            <strong>Vos droits.</strong> Outre l&apos;opposition décrite
            ci-dessus, vous disposez du droit d&apos;accès, d&apos;effacement
            et de réclamation auprès de la{" "}
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              CNIL
            </a>
            .
          </p>
        </Section>

        <Section title="6. Comment refuser ou supprimer les cookies ?">
          <p>
            Outre le panneau de préférences BUUPP, vous pouvez bloquer ou
            supprimer les cookies directement depuis votre navigateur. Le
            paramétrage diffère d&apos;un navigateur à l&apos;autre :
          </p>
          <ul>
            <li>
              <strong>Chrome</strong> — Paramètres → Confidentialité et
              sécurité → Cookies et autres données des sites.
            </li>
            <li>
              <strong>Firefox</strong> — Paramètres → Vie privée et sécurité
              → Cookies et données de sites.
            </li>
            <li>
              <strong>Safari</strong> — Réglages → Confidentialité → Gérer
              les données du site web.
            </li>
            <li>
              <strong>Edge</strong> — Paramètres → Cookies et autorisations
              de sites.
            </li>
          </ul>
          <p style={{ marginTop: 10 }}>
            Le blocage des cookies essentiels peut empêcher certaines
            fonctionnalités de la plateforme (connexion à votre espace,
            lancement d&apos;une campagne, validation d&apos;une mise en
            relation).
          </p>
        </Section>

        <Section title="7. Cookies tiers et transferts hors UE">
          <p>
            Certains cookies sont déposés par des prestataires tiers
            (Cloudflare pour la protection anti-bot, Google Analytics pour la
            mesure d&apos;audience, Meta et LinkedIn pour le suivi
            publicitaire). Ces fournisseurs peuvent être amenés à transférer
            les données associées hors de l&apos;Union européenne, selon des
            mécanismes de garanties appropriés (clauses contractuelles types
            de la Commission européenne, le cas échéant). Le détail figure
            dans la politique de confidentialité de chaque fournisseur,
            accessible depuis leur site officiel.
          </p>
        </Section>

        <Section title="8. Vos droits et nous contacter">
          <p>
            Conformément au RGPD et à la Loi Informatique et Libertés, vous
            disposez de droits d&apos;accès, de rectification,
            d&apos;effacement, d&apos;opposition, de limitation et de
            portabilité sur les données collectées via les cookies. Pour les
            exercer, consultez notre{" "}
            <Link
              href="/rgpd"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              politique RGPD
            </Link>{" "}
            ou contactez notre{" "}
            <Link
              href="/contact-dpo"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              Chargé à la protection des données
            </Link>
            .
          </p>
          <p style={{ marginTop: 10 }}>
            Vous pouvez également déposer une réclamation auprès de la
            Commission Nationale de l&apos;Informatique et des Libertés —{" "}
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              cnil.fr
            </a>
            .
          </p>
        </Section>

        <Section title="9. Mise à jour de la politique">
          <p>
            La présente politique des cookies peut être mise à jour pour
            refléter l&apos;évolution des outils que nous utilisons ou des
            obligations réglementaires. La date de dernière mise à jour sera
            indiquée ici : <em>à compléter</em>. En cas de modification
            substantielle (ajout d&apos;une nouvelle catégorie, changement de
            prestataire), un nouveau consentement vous sera proposé.
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--ink-3)", textAlign: "justify", hyphens: "auto" }}>
        {children}
      </div>
    </section>
  );
}

function CategoryBlock({ category }: { category: CookieCategory }) {
  const headerColor = category.required ? "var(--good)" : "var(--accent)";
  return (
    <section
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <header style={{ padding: "20px 22px", borderBottom: "1px solid var(--line)" }}>
        <div className="row center wrap" style={{ gap: 10, marginBottom: 6 }}>
          <h3
            className="serif"
            style={{
              fontSize: 20,
              lineHeight: 1.2,
              color: "var(--ink)",
            }}
          >
            {category.title}
          </h3>
          <span
            className="mono caps"
            style={{
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 999,
              background: category.required ? "color-mix(in oklab, var(--good) 12%, var(--paper))" : "var(--ivory-2)",
              color: headerColor,
              border: `1px solid ${headerColor}33`,
              letterSpacing: ".08em",
            }}
          >
            {category.required ? "Toujours actifs" : "Sur consentement"}
          </span>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6 }}>
          {category.description}
        </p>
        <p style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 6 }}>
          Base légale : <span style={{ color: "var(--ink-3)" }}>{category.legalBasis}</span>
        </p>
      </header>
      <CookieTable cookies={category.cookies} />
    </section>
  );
}

function CookieTable({ cookies }: { cookies: CookieEntry[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          color: "var(--ink-3)",
        }}
      >
        <thead>
          <tr
            style={{
              background: "var(--ivory-2)",
              textAlign: "left",
            }}
          >
            <Th>Nom</Th>
            <Th>Émetteur</Th>
            <Th>Finalité</Th>
            <Th>Durée</Th>
            <Th>Type</Th>
          </tr>
        </thead>
        <tbody>
          {cookies.map((c, i) => (
            <tr
              key={c.name + i}
              style={{
                borderTop: "1px solid var(--line)",
              }}
            >
              <Td>
                <span className="mono" style={{ color: "var(--ink)" }}>
                  {c.name}
                </span>
              </Td>
              <Td>{c.provider}</Td>
              <Td style={{ minWidth: 220 }}>{c.purpose}</Td>
              <Td>
                <span className="mono">{c.duration}</span>
              </Td>
              <Td>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background:
                      c.type === "Premier" ? "color-mix(in oklab, var(--accent) 10%, var(--paper))" : "var(--ivory-2)",
                    color: c.type === "Premier" ? "var(--accent)" : "var(--ink-3)",
                    border: "1px solid var(--line)",
                  }}
                >
                  {c.type}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="mono caps"
      style={{
        fontSize: 10,
        letterSpacing: ".1em",
        color: "var(--ink-4)",
        padding: "10px 14px",
        textAlign: "left",
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td style={{ padding: "12px 14px", verticalAlign: "top", ...(style || {}) }}>
      {children}
    </td>
  );
}
