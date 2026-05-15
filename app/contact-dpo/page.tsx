import type { Metadata } from "next";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";
import PageVersion from "../_components/PageVersion";

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
        <PageVersion page="contact-dpo" />
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
            Vous pouvez contacter notre Délégué à la protection des
            données par l&apos;un des moyens suivants&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>Courriel</strong> (privilégié, traitement
              traçable)&nbsp;:{" "}
              <a
                href="mailto:dp.buupp@buupp.com"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                dp.buupp@buupp.com
              </a>
            </li>
            <li>
              <strong>Courrier postal</strong> (recommandé conseillé pour
              les demandes nécessitant une preuve de réception)&nbsp;:{" "}
              <em>
                Majelink — À l&apos;attention du Délégué à la protection
                des données — 12 Impasse des Étriers, 64140 Lons, France
              </em>
            </li>
          </ul>
          <p>
            Pour les demandes sensibles (accès, effacement, signalement
            de fuite), merci d&apos;inclure dans votre message l&apos;e-mail
            associé à votre compte BUUPP et de joindre les éventuels
            justificatifs prévus à l&apos;article&nbsp;4.
          </p>
        </Section>

        <Section title="2. Quand nous contacter ?">
          <p>
            Le DPO est l&apos;interlocuteur dédié pour toute question
            relative à vos données personnelles, à l&apos;usage de la
            plateforme ou à la sécurité de vos informations. Vous pouvez
            le solliciter notamment pour&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              demander la <strong>suppression définitive</strong> de votre
              compte et de vos données (au-delà de l&apos;auto-suppression
              déjà disponible dans le menu latéral du dashboard)&nbsp;;
            </li>
            <li>
              demander un <strong>accès consolidé</strong> à l&apos;ensemble
              des données que nous détenons sur vous (rapport complet,
              portabilité)&nbsp;;
            </li>
            <li>
              corriger ou rectifier une information inexacte dans un
              palier ou un profil&nbsp;;
            </li>
            <li>
              vous opposer au traitement marketing (broadcast de produit,
              pixel de mesure d&apos;ouverture des e-mails)&nbsp;;
            </li>
            <li>
              signaler une <strong>fuite de coordonnées supposée</strong>{" "}
              (mail ou SMS reçus en dehors d&apos;une sollicitation BUUPP
              acceptée par vous, démarchage abusif par un pro)&nbsp;;
            </li>
            <li>
              poser une question sur la conformité d&apos;un traitement,
              un sous-traitant utilisé, ou une mention de la{" "}
              <Link
                href="/rgpd"
                style={{ color: "var(--accent)", textDecoration: "underline" }}
              >
                politique RGPD
              </Link>
              .
            </li>
          </ul>
        </Section>

        <Section title="3. Vos droits RGPD">
          <p>
            Conformément aux articles&nbsp;15 à 22 du Règlement européen
            sur la protection des données (RGPD) et à la loi Informatique
            et Libertés modifiée, vous disposez à tout moment des
            droits suivants sur vos données&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>Accès</strong> (art.&nbsp;15) — obtenir copie de
              toutes les données que nous détenons sur vous.
            </li>
            <li>
              <strong>Rectification</strong> (art.&nbsp;16) — corriger ou
              compléter une donnée inexacte.
            </li>
            <li>
              <strong>Effacement</strong> (art.&nbsp;17, «&nbsp;droit à
              l&apos;oubli&nbsp;») — supprimer définitivement vos
              données, hors archives légales obligatoires.
            </li>
            <li>
              <strong>Limitation</strong> (art.&nbsp;18) — geler le
              traitement le temps d&apos;une vérification.
            </li>
            <li>
              <strong>Portabilité</strong> (art.&nbsp;20) — récupérer vos
              données dans un format structuré, courant et lisible par
              machine.
            </li>
            <li>
              <strong>Opposition</strong> (art.&nbsp;21) — vous opposer
              à un traitement reposant sur l&apos;intérêt légitime ou à
              la prospection commerciale.
            </li>
            <li>
              <strong>Directives post-mortem</strong> (loi
              Informatique et Libertés, art.&nbsp;85) — définir le sort
              de vos données après votre décès.
            </li>
            <li>
              <strong>Retrait du consentement</strong> à tout moment,
              avec effet pour l&apos;avenir, sans remise en cause de la
              licéité des traitements antérieurs.
            </li>
          </ul>
          <p>
            Pour le détail des bases légales et des durées de
            conservation associées à chaque traitement, consultez notre{" "}
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
            Pour les demandes <strong>standards</strong> (rectification
            d&apos;un palier, opposition marketing, désabonnement), un
            simple courriel depuis l&apos;adresse e-mail rattachée à
            votre compte BUUPP suffit. La correspondance entre
            l&apos;adresse expéditrice et l&apos;adresse du compte vaut
            authentification.
          </p>
          <p>
            Pour les demandes <strong>sensibles</strong> — accès complet
            à vos données, effacement définitif, signalement de fuite —
            nous pouvons être amenés à vous demander une{" "}
            <strong>preuve d&apos;identité</strong> afin de prévenir
            toute usurpation. Sont acceptés indifféremment&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              copie d&apos;une pièce d&apos;identité officielle en cours
              de validité (CNI, passeport, titre de séjour) avec
              masquage du numéro de pièce et de la photo si vous le
              souhaitez ;
            </li>
            <li>
              ou un selfie horodaté avec une mention manuscrite
              («&nbsp;Demande RGPD BUUPP — JJ/MM/AAAA&nbsp;») et
              l&apos;e-mail du compte concerné.
            </li>
          </ul>
          <p>
            Ces justificatifs sont conservés{" "}
            <strong>uniquement le temps strictement nécessaire</strong>{" "}
            au traitement de votre demande, puis supprimés.
          </p>
        </Section>

        <Section title="5. Délai de réponse">
          <p>
            Conformément à l&apos;article&nbsp;12.3 du RGPD, nous
            répondons à toute demande dans un délai d&apos;<strong>un
            mois</strong> à compter de sa réception. Ce délai peut être{" "}
            <strong>prolongé de deux mois</strong> pour les demandes
            complexes ou nombreuses ; dans ce cas, nous vous informons
            de la prolongation et de ses motifs dans le mois suivant la
            réception de la demande initiale.
          </p>
          <p>
            En cas de demande manifestement infondée ou excessive (
            <em>notamment en raison de son caractère répétitif</em>), le
            RGPD nous autorise à exiger des frais raisonnables ou à
            refuser la demande, en vous expliquant les motifs. Une telle
            décision peut faire l&apos;objet d&apos;une contestation
            auprès de la CNIL (cf. §6).
          </p>
        </Section>

        <Section title="6. Envoyer une demande au DPO">
          <p>
            Pour transmettre une demande RGPD, utilisez notre formulaire
            en ligne dédié&nbsp;: il vous guide pas à pas et garantit
            que votre demande arrive directement dans la boîte du DPO,
            avec accusé de réception immédiat.
          </p>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/contact-dpo/formulaire"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                background: "var(--ink)",
                color: "var(--paper)",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Ouvrir le formulaire DPO →
            </Link>
            <a
              href="mailto:dp.buupp@buupp.com"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                background: "var(--paper)",
                color: "var(--ink)",
                border: "1px solid var(--line-2)",
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              ou écrire directement à dp.buupp@buupp.com
            </a>
          </div>
        </Section>

        <Section title="7. Recours auprès de la CNIL">
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
          textAlign: "justify",
          hyphens: "auto",
        }}
      >
        {children}
      </div>
    </section>
  );
}
