import type { Metadata } from "next";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";
import PageVersion from "../_components/PageVersion";

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
        <PageVersion version="1.1" updatedAt="15/05/2026" />
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
            <strong>Majelink</strong> — 12 Impasse des Étriers, 64140 Lons —
            SIREN 892 514 167 — RCS Pau 892 514 167 — TVA intracommunautaire
            FR06 892514167. Le responsable de traitement au sens du
            RGPD (article&nbsp;4-7) est la société Majelink, représentée
            par son représentant légal.
          </p>
          <p>
            <strong>Délégué à la protection des données (DPO).</strong>{" "}
            Vous pouvez contacter notre DPO pour toute question relative à
            vos données ou à l&apos;exercice de vos droits&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              Par courriel à{" "}
              <a
                href="mailto:dp.buupp@buupp.com"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                dp.buupp@buupp.com
              </a>
            </li>
            <li>
              Par courrier postal&nbsp;: <em>Majelink — À l&apos;attention
              du DPO — 12 Impasse des Étriers, 64140 Lons</em>
            </li>
            <li>
              Via le{" "}
              <Link
                href="/contact-dpo/formulaire"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                formulaire en ligne dédié
              </Link>
              .
            </li>
          </ul>
        </Section>

        <Section title="2. Données collectées">
          <p>
            BUUPP collecte uniquement les données strictement nécessaires
            aux finalités décrites à l&apos;article&nbsp;3, conformément
            au principe de{" "}
            <Link
              href="/minimisation"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              minimisation
            </Link>
            {" "}(RGPD art.&nbsp;5.1.c). Les catégories de données
            traitées sont&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>Données d&apos;authentification</strong> (prospects
              et pros)&nbsp;: identifiant Clerk, adresse e-mail, méthode
              de connexion (mot de passe, Google, Apple).
            </li>
            <li>
              <strong>Données de profil prospect — Palier 1 (Identification)</strong>{" "}
              : prénom, nom, e-mail, téléphone (vérifié par SMS), date de
              naissance, genre, nationalité.
            </li>
            <li>
              <strong>Palier 2 (Localisation)</strong>&nbsp;: adresse,
              code postal, ville, type de logement, mobilité géographique
              — facultatif.
            </li>
            <li>
              <strong>Palier 3 (Style de vie)</strong>&nbsp;: famille,
              véhicule, sport, animaux, alimentation — facultatif.
            </li>
            <li>
              <strong>Palier 4 (Données professionnelles)</strong>&nbsp;:
              poste, revenus, statut, secteur — facultatif.
            </li>
            <li>
              <strong>Palier 5 (Patrimoine &amp; projets)</strong>&nbsp;:
              propriétaire / locataire, épargne, projet immobilier,
              succession, création d&apos;entreprise — facultatif.
            </li>
            <li>
              <strong>Données de profil pro</strong>&nbsp;: raison sociale,
              SIREN/SIRET, secteur, forme juridique, adresse, code postal,
              ville, RCS, capital social, plan.
            </li>
            <li>
              <strong>Données de paiement</strong>&nbsp;: identifiant client
              Stripe (token), IBAN du prospect (pour retraits), historique
              des transactions wallet, factures émises. Aucune donnée
              carte complète n&apos;est stockée par BUUPP.
            </li>
            <li>
              <strong>Données de relation</strong>&nbsp;: sollicitations
              reçues, acceptations, refus, motif rédigé par le pro, date
              de décision, code d&apos;authentification de campagne,
              évaluation post-contact (atteint / non&nbsp;atteint).
            </li>
            <li>
              <strong>Données fiscales</strong>&nbsp;: cumul annuel des
              gains, nombre de transactions, attestations DGFiP générées
              (palier déclencheur DAC7&nbsp;: 2&nbsp;000&nbsp;€ ou
              30&nbsp;transactions par an).
            </li>
            <li>
              <strong>Données techniques de la waitlist</strong>&nbsp;:
              hash IP (SHA-256 tronqué), user-agent — finalité anti-bot,
              durée 12 mois.
            </li>
            <li>
              <strong>Cookies</strong>&nbsp;: voir{" "}
              <Link
                href="/cookies"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                politique des cookies
              </Link>
              .
            </li>
          </ul>
        </Section>

        <Section title="3. Finalités du traitement">
          <ul style={{ paddingLeft: 22 }}>
            <li>
              <strong>Création et gestion du compte utilisateur</strong>{" "}
              (prospect ou pro) — vérification e-mail, authentification,
              vérification téléphone, sécurité du compte.
            </li>
            <li>
              <strong>Mise en relation rémunérée</strong> entre prospects
              et pros — ciblage par palier, double consentement, calcul
              de la rémunération, traçabilité du contrat.
            </li>
            <li>
              <strong>Calcul du BUUPP Score</strong> (qualité de profil
              prospect) — segmentation par les pros, valorisation du
              profil pour le prospect.
            </li>
            <li>
              <strong>Gestion financière</strong>&nbsp;: paiement des
              abonnements pro, recharge des portefeuilles, séquestre,
              débit, retrait sur IBAN du prospect.
            </li>
            <li>
              <strong>Émission de factures et obligations fiscales</strong>{" "}
              (CGI art.&nbsp;242&nbsp;bis, directive UE DAC7)&nbsp;:
              transmission DGFiP au-delà des seuils déclaratifs.
            </li>
            <li>
              <strong>Communication transactionnelle et de service</strong>{" "}
              — emails de confirmation de sollicitation, alertes
              d&apos;encaissement, notifications produit.
            </li>
            <li>
              <strong>Analyse interne du Service</strong> — agrégats
              anonymisés, mesure de la qualité des broadcasts (pixel de
              tracking soumis au consentement), back-office admin.
            </li>
            <li>
              <strong>Prévention de la fraude</strong>&nbsp;: anti-doublon
              (IBAN, téléphone, e-mail), exclusivité de rôle, détection
              de freeloaders (signalements «&nbsp;non atteint&nbsp;»),
              alertes anti-exfiltration côté pro (watermarking).
            </li>
          </ul>
        </Section>

        <Section title="4. Bases légales">
          <p>Chaque traitement repose sur l&apos;une des bases suivantes&nbsp;:</p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>Exécution du contrat</strong> (RGPD art.&nbsp;6.1.b) —
              ouverture du compte, mise en relation, paiement, facturation,
              séquestre, retraits, gestion des sollicitations.
            </li>
            <li>
              <strong>Consentement</strong> (RGPD art.&nbsp;6.1.a) —
              complétion des paliers facultatifs (2 à 5), acceptation
              d&apos;une sollicitation, cookies non strictement
              nécessaires, pixel de mesure d&apos;ouverture des
              broadcasts (cf. §9).
            </li>
            <li>
              <strong>Obligation légale</strong> (RGPD art.&nbsp;6.1.c) —
              transmission DGFiP (DAC7 / art.&nbsp;242&nbsp;bis CGI),
              conservation comptable, lutte contre le blanchiment.
            </li>
            <li>
              <strong>Intérêt légitime</strong> (RGPD art.&nbsp;6.1.f) —
              prévention de la fraude, anti-bot waitlist, sécurité du
              Service, statistiques agrégées d&apos;usage.
            </li>
          </ul>
        </Section>

        <Section title="5. Durée de conservation">
          <p>
            Les données sont conservées strictement le temps nécessaire à
            la finalité poursuivie, dans le respect des durées légales
            applicables&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>Compte actif</strong>&nbsp;: tant que le compte est
              actif (prospect ou pro).
            </li>
            <li>
              <strong>Compte clôturé</strong>&nbsp;: suppression immédiate
              des données identifiantes ; conservation des transactions
              en archive pendant <strong>10&nbsp;ans</strong> au titre des
              obligations comptables et fiscales (art.&nbsp;L.&nbsp;123-22
              du Code de commerce).
            </li>
            <li>
              <strong>Données fiscales</strong> (DAC7)&nbsp;:
              6&nbsp;ans à compter de la fin de l&apos;exercice concerné.
            </li>
            <li>
              <strong>Logs techniques et de sécurité</strong>&nbsp;:
              12&nbsp;mois maximum.
            </li>
            <li>
              <strong>Tracking pixel des broadcasts</strong>&nbsp;:
              13&nbsp;mois après envoi (cf. §9).
            </li>
            <li>
              <strong>Emails Pro → Prospect (Actions intégrées BUUPP)</strong>
              &nbsp;: sujet et corps des emails envoyés via la
              plateforme conservés <strong>12&nbsp;mois</strong> à des
              fins d&apos;audit anti-spam et de détection d&apos;abus.
              Le tracking d&apos;ouverture (pixel) n&apos;est inséré
              qu&apos;avec consentement explicite, traçabilité identique
              au pixel des broadcasts.
            </li>
            <li>
              <strong>Actions de contact (click-to-call,
              audit)</strong>&nbsp;: 24&nbsp;mois après l&apos;événement
              à des fins de preuve en cas de litige ou de signalement.
            </li>
            <li>
              <strong>Données IP hashées (waitlist)</strong>&nbsp;:
              12&nbsp;mois.
            </li>
            <li>
              <strong>Cookies non essentiels</strong>&nbsp;: 13&nbsp;mois
              maximum (recommandation CNIL).
            </li>
          </ul>
        </Section>

        <Section title="6. Destinataires">
          <p>
            Les données sont accessibles uniquement aux{" "}
            <strong>personnels habilités</strong> de Majelink (équipe
            produit, support, conformité) et à nos{" "}
            <strong>sous-traitants techniques</strong>, liés par un
            accord de traitement (DPA) conforme à
            l&apos;article&nbsp;28 du RGPD&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>Clerk Inc.</strong> (États-Unis)&nbsp;:
              authentification, sessions, gestion des identifiants. SCC
              (Clauses Contractuelles Types) en place.
            </li>
            <li>
              <strong>Supabase Inc.</strong> (hébergement EU, Francfort) —
              base de données PostgreSQL + Storage. Les données sont
              hébergées dans l&apos;Union européenne.
            </li>
            <li>
              <strong>Stripe Payments Europe Limited</strong>
              (Irlande)&nbsp;: traitement des paiements carte. Stripe est
              responsable de traitement distinct pour les données carte
              (PCI&nbsp;DSS niveau&nbsp;1).
            </li>
            <li>
              <strong>Brevo</strong> (France)&nbsp;: envoi des SMS de
              vérification téléphone.
            </li>
            <li>
              <strong>Google Workspace / Gmail SMTP</strong> (États-Unis)
              : transmission des courriels transactionnels et des
              broadcasts. SCC en place.
            </li>
            <li>
              <strong>Vercel Inc.</strong> (États-Unis, infrastructure
              servie en EU)&nbsp;: hébergement de la plateforme. SCC en
              place.
            </li>
            <li>
              <strong>DGFiP</strong> (Direction générale des Finances
              publiques)&nbsp;: transmission annuelle des récapitulatifs
              de revenus prospects (DAC7).
            </li>
            <li>
              <strong>Professionnels destinataires d&apos;une
              sollicitation acceptée</strong>&nbsp;: ils deviennent{" "}
              <em>responsables de traitement distincts</em> pour les
              coordonnées révélées.
            </li>
          </ul>
          <p>
            Aucune donnée prospect n&apos;est cédée, louée ou revendue à
            des tiers à des fins commerciales hors du cadre d&apos;une
            sollicitation acceptée par le prospect lui-même.
          </p>
        </Section>

        <Section title="7. Vos droits">
          <p>
            Conformément aux articles 15 à 22 du RGPD, vous disposez des
            droits suivants sur vos données&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>Droit d&apos;accès</strong>&nbsp;: obtenir copie des
              données que nous détenons sur vous.
            </li>
            <li>
              <strong>Droit de rectification</strong>&nbsp;: corriger toute
              donnée inexacte ou incomplète (la plupart des champs sont
              modifiables directement depuis votre tableau de bord).
            </li>
            <li>
              <strong>Droit à l&apos;effacement</strong>&nbsp;:
              suppression définitive du compte et des données associées,
              hors archives légales.
            </li>
            <li>
              <strong>Droit à la limitation</strong> du traitement.
            </li>
            <li>
              <strong>Droit à la portabilité</strong>&nbsp;: recevoir vos
              données dans un format structuré, courant et lisible par
              machine.
            </li>
            <li>
              <strong>Droit d&apos;opposition</strong> au traitement, y
              compris au tracking pixel des broadcasts (désactivable
              dans «&nbsp;Préférences&nbsp;» de votre dashboard).
            </li>
            <li>
              <strong>Droit de définir des directives post-mortem</strong>{" "}
              sur le sort de vos données après votre décès (loi
              Informatique et Libertés, art.&nbsp;85).
            </li>
          </ul>
          <p>
            Pour exercer ces droits, contactez notre DPO à{" "}
            <a
              href="mailto:dp.buupp@buupp.com"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              dp.buupp@buupp.com
            </a>{" "}
            ou via la page{" "}
            <Link
              href="/contact-dpo"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              Contact DPO
            </Link>
            . Nous répondons dans un délai de <strong>30&nbsp;jours</strong>
            {" "}à compter de la réception de votre demande (prolongeable
            de 60&nbsp;jours pour les demandes complexes).
          </p>
          <p>
            En cas de désaccord avec notre réponse, vous pouvez
            introduire une réclamation auprès de la CNIL —{" "}
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

        <Section title="9. Pixels de suivi dans les emails BUUPP">
          <p>
            Les broadcasts envoyés par l’équipe BUUPP depuis le back-office
            (mises à jour CGU, communications produit, annonces) peuvent
            contenir un <strong>pixel de mesure d’audience</strong> —
            image 1×1 transparente dont le chargement par votre client mail
            permet de comptabiliser, de manière agrégée, le taux d’ouverture
            du broadcast.
          </p>
          <ul>
            <li>
              <strong>Finalité.</strong> Pilotage interne de la qualité de
              nos communications (fréquence, objet, contenu). Aucune
              utilisation commerciale, aucune relance ciblée, aucun
              croisement avec un traitement tiers.
            </li>
            <li>
              <strong>Base légale.</strong> Consentement préalable, en
              application de l’article 82 de la loi Informatique et Libertés
              et de la{" "}
              <a
                href="https://www.cnil.fr/fr/recommandation-pixel-suivi-courriels"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--accent)",
                  textDecoration: "underline",
                }}
              >
                recommandation CNIL n°&nbsp;2026-042
              </a>
              . Tant que le mécanisme de recueil du consentement n’est pas
              déployé (échéance au 14 juillet 2026), nous appliquons les
              mesures transitoires détaillées dans la{" "}
              <Link
                href="/cookies"
                style={{
                  color: "var(--accent)",
                  textDecoration: "underline",
                }}
              >
                politique des cookies §5
              </Link>{" "}
              : information à chaque envoi + droit d’opposition immédiat
              par simple message au DPO.
            </li>
            <li>
              <strong>Données collectées.</strong> Identifiant opaque de
              destinataire (UUID non énumérable), date de première
              ouverture, compteur d’ouvertures. Aucune adresse IP, aucun
              user-agent, aucune géolocalisation, aucun fingerprint.
            </li>
            <li>
              <strong>Durée.</strong> 13 mois après l’envoi du broadcast.
            </li>
            <li>
              <strong>Droits.</strong> Opposition, accès, effacement,
              portabilité, limitation. À exercer auprès du DPO (voir §7).
              Réclamation possible auprès de la CNIL.
            </li>
          </ul>
        </Section>

        <Section title="10. Modifications">
          <p>
            La présente politique peut être mise à jour pour refléter une
            évolution réglementaire, une nouvelle fonctionnalité ou un
            changement de sous-traitant. Les modifications substantielles
            sont notifiées à l&apos;utilisateur par message in-app et/ou
            courriel au moins <strong>30&nbsp;jours</strong> avant leur
            entrée en vigueur.
          </p>
          <p>
            <strong>Dernière mise à jour&nbsp;:</strong> 01/06/2026.
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
