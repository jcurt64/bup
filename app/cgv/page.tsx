import type { Metadata } from "next";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente — BUUPP",
  description:
    "Conditions Générales de Vente applicables aux professionnels souscrivant aux services BUUPP.",
};

export default function CgvPage() {
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
          Conditions générales de vente
        </div>
        <h1
          className="serif"
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            lineHeight: 1.05,
            marginBottom: 18,
          }}
        >
          Achat des services BUUPP
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--ink-3)",
            maxWidth: 680,
          }}
        >
          Les présentes CGV régissent les commandes passées par les
          professionnels (plans Starter / Pro, lancement de campagnes,
          recharges de portefeuille) auprès de BUUPP. Elles complètent les
          Conditions Générales d&apos;Utilisation et prévalent en cas de
          contradiction sur le volet commercial.
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
              À compléter : périmètre des CGV, public visé (professionnels
              uniquement, B2B).
            </em>
          </p>
        </Section>

        <Section title="2. Identification du vendeur">
          <p>
            Majelink — 12 Impasse des Étriers, 64140 Lons — RCS Pau 892 514
            167. Numéro de TVA et autres mentions légales :{" "}
            <em>à compléter</em>.
          </p>
        </Section>

        <Section title="3. Description des prestations">
          <p>
            <em>
              À compléter : plans Starter (19 € / 2 campagnes) et Pro (59 € /
              10 campagnes), accès aux paliers, lancement de campagnes,
              révélation des coordonnées prospects, BUUPP Score.
            </em>
          </p>
        </Section>

        <Section title="4. Tarifs et modalités de calcul">
          <p>
            <em>
              À compléter : grille de prix par palier, multiplicateur de
              durée (1h / 24h / 48h / 7j), commission BUUPP de 10 % sur
              campagne acceptée, bonus ×2 « certifié confiance », tarifs HT.
            </em>
          </p>
        </Section>

        <Section title="5. Modalités de paiement">
          <p>
            <em>
              À compléter : paiement par carte via Stripe, débit lors de la
              recharge du portefeuille, débit réel à l&apos;acceptation de la
              mise en relation, sécurité des transactions.
            </em>
          </p>
        </Section>

        <Section title="6. Cycle de campagne et quotas">
          <p>
            <em>
              À compléter : notion de cycle, quota par plan (2 / 10), frais
              d&apos;accès facturés une seule fois en début de cycle,
              renouvellement par re-sélection du mode.
            </em>
          </p>
        </Section>

        <Section title="7. Crédit du portefeuille et remboursement">
          <p>
            <em>
              À compléter : crédit non remboursable hors cas légaux,
              annulation d&apos;une campagne avant lancement, refus
              postérieur d&apos;un prospect (refund automatique vers le
              wallet), commission non perçue.
            </em>
          </p>
        </Section>

        <Section title="8. Pause et prolongation de campagne">
          <p>
            <em>
              À compléter : pause one-shot disponible toutes durées,
              prolongation payante, conditions et coût.
            </em>
          </p>
        </Section>

        <Section title="9. Droit de rétractation">
          <p>
            <em>
              À compléter : exclusion du droit de rétractation pour les
              contrats conclus entre professionnels (B2B), mention de
              l&apos;article L.221-3 du Code de la consommation le cas
              échéant.
            </em>
          </p>
        </Section>

        <Section title="10. Engagements du professionnel">
          <p>
            <em>
              À compléter : usage strictement professionnel, respect du
              consentement prospect, interdiction de réutilisation des
              coordonnées hors campagne, watermarking et traçabilité.
            </em>
          </p>
        </Section>

        <Section title="11. Garantie et responsabilité">
          <p>
            <em>
              À compléter : limites de responsabilité, performance des
              campagnes (taux d&apos;acceptation non garanti), force majeure,
              indisponibilité service.
            </em>
          </p>
        </Section>

        <Section title="12. Données personnelles">
          <p>
            Le traitement des données personnelles côté prospects est encadré
            par notre{" "}
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
            . Le professionnel agit en tant que responsable de traitement
            distinct dès la révélation des coordonnées.
          </p>
        </Section>

        <Section title="13. Suspension du compte professionnel">
          <p>
            <em>
              À compléter : motifs (fraude, exfiltration de données,
              non-paiement), procédure, conséquences sur les campagnes en
              cours et le solde de portefeuille.
            </em>
          </p>
        </Section>

        <Section title="14. Litiges, médiation et juridiction">
          <p>
            <em>
              À compléter : tentative de règlement amiable préalable, droit
              français applicable, juridiction compétente.
            </em>
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
