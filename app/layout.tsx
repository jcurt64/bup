import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";

// Override de la traduction Clerk par défaut pour expliquer la règle
// d'exclusivité de rôle (cf. trigger DB + ensureRole).
const buppFrFR = {
  ...frFR,
  unstable__errors: {
    ...frFR.unstable__errors,
    form_identifier_exists__email_address:
      "Cette adresse e-mail est déjà utilisée sur BUUPP. Une adresse mail = un seul compte, prospect ou professionnel. Connectez-vous avec ce compte ou utilisez une autre adresse pour créer le second.",
  },
};
import "./globals.css";
import RouteNav from "./_components/RouteNav";
import CookieConsent from "./_components/CookieConsent";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// URL absolue de production — utilisée par Next.js pour générer
// automatiquement les URLs absolues dans les balises Open Graph,
// Twitter Card et alternates.canonical. À mettre à jour si le domaine
// principal change.
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.buupp.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BUUPP — Soyez payé pour partager vos données",
    template: "%s — BUUPP",
  },
  description:
    "BUUPP est la première plateforme qui rémunère les particuliers pour accepter d'être contactés par les professionnels qui les ciblent vraiment. Vos données, votre prix.",
  applicationName: "BUUPP",
  authors: [{ name: "Majelink" }],
  generator: "Next.js",
  keywords: [
    "BUUPP",
    "consentement",
    "données personnelles",
    "rémunération",
    "RGPD",
    "mise en relation",
    "double consentement",
    "prospects",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "BUUPP",
    title: "BUUPP — Soyez payé pour partager vos données",
    description:
      "Plateforme de mise en relation rémunérée à double consentement. Vos données ne sont jamais transmises sans votre accord explicite.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "BUUPP",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BUUPP — Soyez payé pour partager vos données",
    description:
      "Plateforme de mise en relation rémunérée à double consentement.",
    images: ["/logo.png"],
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// JSON-LD Organization — injecté en haut du <body> pour aider Google à
// identifier l'entité éditrice. Utilise le SITE_URL du metadataBase pour
// rester cohérent avec le domaine de production.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BUUPP",
  legalName: "Majelink",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description:
    "Plateforme française de mise en relation rémunérée à double consentement entre particuliers et professionnels.",
  foundingDate: "2026",
  founders: [{ "@type": "Organization", name: "Majelink" }],
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
      contactType: "Délégué à la protection des données (DPO)",
      email: "dp.buupp@buupp.com",
      availableLanguage: "French",
    },
    {
      "@type": "ContactPoint",
      contactType: "Service commercial",
      email: "contact@buupp.com",
      availableLanguage: "French",
    },
  ],
  identifier: { "@type": "PropertyValue", name: "RCS Pau", value: "892 514 167" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={buppFrFR}>
      <html
        lang="fr"
        className={`${fraunces.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      >
        <body data-palette="indigo" suppressHydrationWarning>
          {/* JSON-LD Organization (rich snippets pour Google).
              Injecté avec dangerouslySetInnerHTML car c'est la pratique
              recommandée Next.js — l'objet est entièrement contrôlé côté
              serveur (zéro input utilisateur), aucun risque XSS. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
          />
          {children}
          <RouteNav />
          <CookieConsent />
        </body>
      </html>
    </ClerkProvider>
  );
}
