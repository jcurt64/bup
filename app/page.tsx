import HomeClient from "./_components/HomeClient";
import RoleConflictToast from "./_components/RoleConflictToast";

type Role = "prospect" | "pro";

type SearchParams = Promise<{ role_conflict?: string | string[] }>;

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.buupp.com";

// Données structurées Schema.org pour la page d'accueil. Aide Google à
// comprendre l'éditeur, le moyen de contact et le moteur de recherche du
// site → rich results + meilleur référencement des sections À propos/Contact.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "BUUPP",
      legalName: "Majelink",
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      description:
        "Plateforme française de mise en relation rémunérée à double consentement, conçue autour de l'expertise RGPD et de la sécurité des données personnelles.",
      address: {
        "@type": "PostalAddress",
        streetAddress: "12 Impasse des Étriers",
        postalCode: "64140",
        addressLocality: "Lons",
        addressCountry: "FR",
      },
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer service",
          email: "contact@buupp.com",
          availableLanguage: ["French"],
        },
        {
          "@type": "ContactPoint",
          contactType: "data protection officer",
          email: "dp.buupp@buupp.com",
          availableLanguage: ["French"],
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "BUUPP",
      inLanguage: "fr-FR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default async function HomePage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.role_conflict) ? sp.role_conflict[0] : sp.role_conflict;
  const conflictRole: Role | null = raw === "prospect" || raw === "pro" ? raw : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {conflictRole && <RoleConflictToast existingRole={conflictRole} />}
      <HomeClient />
    </>
  );
}
