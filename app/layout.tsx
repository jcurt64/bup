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

export const metadata: Metadata = {
  title: "BUUPP — Be Used, Paid & Proud (HMR test)",
  description:
    "BUUPP est la première plateforme qui rémunère les particuliers pour accepter d'être contactés par les professionnels qui les ciblent vraiment.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
          {children}
          <RouteNav />
          <CookieConsent />
        </body>
      </html>
    </ClerkProvider>
  );
}
