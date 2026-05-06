/**
 * Catalogue des cookies utilisés par BUUPP.
 * Données fictives — à compléter avec les vrais cookies posés par l'app
 * et les services tiers réellement intégrés (Analytics, Pixel, etc.).
 */

export type CookieEntry = {
  name: string;
  provider: string;
  purpose: string;
  duration: string;
  type: "Premier" | "Tiers";
};

export type CookieCategoryId =
  | "essential"
  | "preferences"
  | "statistics"
  | "marketing";

export type CookieCategory = {
  id: CookieCategoryId;
  title: string;
  description: string;
  legalBasis: string;
  required: boolean;
  cookies: CookieEntry[];
};

export const COOKIE_CATEGORIES: CookieCategory[] = [
  {
    id: "essential",
    title: "Cookies essentiels",
    description:
      "Indispensables au fonctionnement du site (authentification, sécurité, persistance du panier de consentement). Ils ne peuvent pas être désactivés.",
    legalBasis: "Intérêt légitime — exemption de consentement (art. 82 LIL)",
    required: true,
    cookies: [
      {
        name: "bupp_session",
        provider: "BUUPP",
        purpose: "Maintien de la session utilisateur connectée.",
        duration: "Session",
        type: "Premier",
      },
      {
        name: "bupp_csrf",
        provider: "BUUPP",
        purpose: "Protection contre les attaques CSRF sur les formulaires.",
        duration: "Session",
        type: "Premier",
      },
      {
        name: "bupp_consent",
        provider: "BUUPP",
        purpose: "Mémorise vos choix de consentement aux cookies.",
        duration: "13 mois",
        type: "Premier",
      },
      {
        name: "__cf_bm",
        provider: "Cloudflare",
        purpose:
          "Distinction entre trafic humain et automatisé pour la protection anti-bot.",
        duration: "30 minutes",
        type: "Tiers",
      },
    ],
  },
  {
    id: "preferences",
    title: "Cookies de préférences",
    description:
      "Permettent de mémoriser vos choix d'affichage (langue, thème) afin de personnaliser votre expérience à chaque visite.",
    legalBasis: "Consentement (art. 6.1.a RGPD)",
    required: false,
    cookies: [
      {
        name: "bupp_lang",
        provider: "BUUPP",
        purpose: "Mémorise la langue d'affichage choisie.",
        duration: "12 mois",
        type: "Premier",
      },
      {
        name: "bupp_palette",
        provider: "BUUPP",
        purpose: "Mémorise le thème de couleurs sélectionné.",
        duration: "12 mois",
        type: "Premier",
      },
    ],
  },
  {
    id: "statistics",
    title: "Cookies statistiques",
    description:
      "Mesurent la fréquentation et l'usage du site pour comprendre comment l'améliorer. Les données sont anonymisées dans la mesure du possible.",
    legalBasis: "Consentement (art. 6.1.a RGPD)",
    required: false,
    cookies: [
      {
        name: "_ga",
        provider: "Google Analytics (Google LLC)",
        purpose: "Identifiant unique anonymisé pour distinguer les visiteurs.",
        duration: "13 mois",
        type: "Tiers",
      },
      {
        name: "_ga_XXXXXX",
        provider: "Google Analytics (Google LLC)",
        purpose: "Persistance de l'état de session pour la mesure d'audience.",
        duration: "13 mois",
        type: "Tiers",
      },
    ],
  },
  {
    id: "marketing",
    title: "Cookies marketing",
    description:
      "Utilisés pour mesurer l'efficacité de nos campagnes publicitaires et personnaliser les annonces sur les réseaux sociaux et plateformes partenaires.",
    legalBasis: "Consentement (art. 6.1.a RGPD)",
    required: false,
    cookies: [
      {
        name: "_fbp",
        provider: "Meta Platforms, Inc.",
        purpose:
          "Identification du navigateur pour le suivi des conversions publicitaires.",
        duration: "3 mois",
        type: "Tiers",
      },
      {
        name: "li_at",
        provider: "LinkedIn (Microsoft Corp.)",
        purpose:
          "Mesure de la performance des annonces et reciblage publicitaire.",
        duration: "12 mois",
        type: "Tiers",
      },
    ],
  },
];

export const CONSENT_STORAGE_KEY = "bupp:cookie-consent:v1";
export const CONSENT_DURATION_MS = 13 * 30 * 24 * 60 * 60 * 1000;

export type ConsentChoices = Record<CookieCategoryId, boolean>;

export type ConsentState = {
  version: 1;
  decidedAt: string;
  expiresAt: string;
  choices: ConsentChoices;
};

export const DEFAULT_CHOICES: ConsentChoices = {
  essential: true,
  preferences: false,
  statistics: false,
  marketing: false,
};

export const ALL_ACCEPTED: ConsentChoices = {
  essential: true,
  preferences: true,
  statistics: true,
  marketing: true,
};
