import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// Page publique exigée par Google Play (section « Sécurité des données ») :
// procédure de suppression du compte BUUPP et données supprimées /
// conservées. Lien renseigné dans la Play Console.
export const metadata: Metadata = {
  title: "Supprimer mon compte — BUUPP",
  description:
    "Comment supprimer votre compte BUUPP (application mobile et site web) et quelles données sont supprimées ou conservées.",
};

export default function SuppressionComptePage() {
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
          <Image
            src="/logo.png"
            alt="BUUPP"
            width={800}
            height={295}
            style={{ height: 44, width: "auto", display: "block" }}
          />
        </Link>
        <div className="mono caps" style={{ color: "var(--ink-4)", marginBottom: 14 }}>
          BUUPP — édité par MAJELINK
        </div>
        <h1
          className="serif"
          style={{ fontSize: "clamp(36px, 6vw, 64px)", lineHeight: 1.05, marginBottom: 18 }}
        >
          Supprimer mon compte
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--ink-3)", maxWidth: 680 }}>
          Vous pouvez supprimer votre compte BUUPP à tout moment, gratuitement,
          depuis l&apos;application mobile, le site web ou sur simple demande.
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
        <Section title="1. Depuis l'application mobile BUUPP">
          <ol style={{ paddingLeft: 22 }}>
            <li>Ouvrez l&apos;application BUUPP et connectez-vous.</li>
            <li>Ouvrez le menu (icône en haut à gauche).</li>
            <li>
              Touchez <strong>« Supprimer mon compte »</strong>, puis confirmez.
            </li>
          </ol>
        </Section>

        <Section title="2. Depuis le site www.buupp.com">
          <ol style={{ paddingLeft: 22 }}>
            <li>Connectez-vous à votre espace sur www.buupp.com.</li>
            <li>Ouvrez le menu latéral de votre tableau de bord.</li>
            <li>
              Cliquez sur <strong>« Supprimer mon compte »</strong>, puis confirmez.
            </li>
          </ol>
        </Section>

        <Section title="3. Sans accès à votre compte">
          <p>
            Écrivez-nous depuis l&apos;adresse e-mail associée à votre compte à{" "}
            <a href="mailto:support@buupp.com" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              support@buupp.com
            </a>{" "}
            ou à notre chargé de la protection des données (
            <Link href="/contact-dpo" style={{ color: "var(--accent)", textDecoration: "underline" }}>
              page contact DPO
            </Link>
            ). Nous traitons la demande sous 30 jours au plus.
          </p>
        </Section>

        <Section title="4. Données supprimées">
          <p>La suppression est définitive et entraîne l&apos;effacement de&nbsp;:</p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>votre compte et vos identifiants de connexion&nbsp;;</li>
            <li>
              vos données de profil (identité, coordonnées, adresse, paliers de
              données, préférences, RIB)&nbsp;;
            </li>
            <li>vos jetons de notification et vos réglages&nbsp;;</li>
            <li>
              pour un compte professionnel&nbsp;: vos informations d&apos;entreprise,
              campagnes et segments.
            </li>
          </ul>
          <p>
            Pensez à retirer vos gains avant la suppression&nbsp;: le solde non
            retiré est perdu.
          </p>
        </Section>

        <Section title="5. Données conservées et durées">
          <p>
            Certaines données doivent être conservées pour respecter nos
            obligations légales, sous une forme limitée à ce qui est nécessaire&nbsp;:
          </p>
          <ul style={{ paddingLeft: 22, marginTop: 8 }}>
            <li>
              <strong>factures et pièces comptables</strong> (paiements,
              recharges, retraits)&nbsp;: 10&nbsp;ans, conformément au Code de
              commerce&nbsp;;
            </li>
            <li>
              les coordonnées déjà transmises à un professionnel lors d&apos;une
              mise en relation que vous avez acceptée restent sous la
              responsabilité de ce professionnel.
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="serif"
        style={{ fontSize: "clamp(22px, 3vw, 28px)", lineHeight: 1.2, marginBottom: 12 }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--ink-3)" }}>{children}</div>
    </section>
  );
}
