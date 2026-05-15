/**
 * Registre central des versions des pages du footer (sections Ressources
 * et Légal). Source unique de vérité pour :
 *  - le badge "Version X" affiché en haut de chaque page (PageVersion),
 *  - le tableau "Versionning" du Centre d'aide (/aide).
 *
 * Pour publier une nouvelle version : ajouter une entrée à `history`
 * (en dernière position). Le badge de la page et la ligne dans le
 * tableau sont mis à jour automatiquement.
 */

export type PageSlug =
  | "bareme"
  | "aide"
  | "status"
  | "accessibilite"
  | "minimisation"
  | "cgu"
  | "cgv"
  | "rgpd"
  | "cookies"
  | "contact-dpo";

export type FooterSection = "ressources" | "legal";

export type VersionEntry = {
  /** Numéro de version, ex. "1.0", "1.1", "2.0". */
  version: string;
  /** Date de mise en ligne (ISO YYYY-MM-DD). */
  date: string;
  /** Résumé bref (1 phrase) des modifications de cette version. */
  summary: string;
};

export type PageMeta = {
  slug: PageSlug;
  href: string;
  title: string;
  section: FooterSection;
  /** Historique chronologique : la version la plus récente en DERNIER. */
  history: VersionEntry[];
};

const INITIAL_RELEASE = "2026-05-15";

export const PAGE_VERSIONS: PageMeta[] = [
  // — Ressources —
  {
    slug: "bareme",
    href: "/bareme",
    title: "Barème des paliers",
    section: "ressources",
    history: [
      { version: "1.0", date: INITIAL_RELEASE, summary: "Version initiale." },
    ],
  },
  {
    slug: "aide",
    href: "/aide",
    title: "Centre d'aide",
    section: "ressources",
    history: [
      { version: "1.0", date: INITIAL_RELEASE, summary: "Version initiale." },
      {
        version: "1.1",
        date: "2026-05-15",
        summary:
          "Anti-fraude : remplacement du wording « empreinte appareil + scoring comportemental » par la description réelle (contraintes UNIQUE IBAN/téléphone/rôle, journal d'audit des révélations, honeypot waitlist + DPO).",
      },
      {
        version: "1.2",
        date: "2026-05-15",
        summary:
          "Watermark cryptographique des emails révélés : chaque relation reçoit un alias unique `prospect+rXXX@buupp.com` routé via Cloudflare Email Worker. Toute fuite remonte instantanément au pro émetteur.",
      },
    ],
  },
  {
    slug: "status",
    href: "/status",
    title: "Statut de la plateforme",
    section: "ressources",
    history: [
      { version: "1.0", date: INITIAL_RELEASE, summary: "Version initiale." },
    ],
  },
  {
    slug: "accessibilite",
    href: "/accessibilite",
    title: "Accessibilité",
    section: "ressources",
    history: [
      { version: "1.0", date: INITIAL_RELEASE, summary: "Version initiale." },
    ],
  },
  {
    slug: "minimisation",
    href: "/minimisation",
    title: "Minimisation des données",
    section: "ressources",
    history: [
      { version: "1.0", date: INITIAL_RELEASE, summary: "Version initiale." },
    ],
  },

  // — Légal —
  {
    slug: "cgu",
    href: "/cgu",
    title: "Conditions Générales d'Utilisation",
    section: "legal",
    history: [
      { version: "1.0", date: INITIAL_RELEASE, summary: "Version initiale." },
      {
        version: "1.1",
        date: "2026-05-15",
        summary:
          "Clarification de la traçabilité des coordonnées révélées : remplacement de « watermarking individuel » par la description du journal d'audit serveur (horodatage, identification du Pro, recoupement sur signalement).",
      },
      {
        version: "1.2",
        date: "2026-05-15",
        summary:
          "Mise en place d'un watermark cryptographique : les emails révélés au Pro sont des alias uniques `prospect+rXXX@buupp.com` routés vers le vrai email du prospect via Cloudflare. Toute fuite est traçable nominativement, sans recoupement de logs.",
      },
    ],
  },
  {
    slug: "cgv",
    href: "/cgv",
    title: "Conditions Générales de Vente",
    section: "legal",
    history: [
      { version: "1.0", date: INITIAL_RELEASE, summary: "Version initiale." },
      {
        version: "1.1",
        date: "2026-05-15",
        summary:
          "Précision sur l'accès aux coordonnées révélées : « watermarking individuel » remplacé par « une révélation par couple Pro/prospect, chaque accès tracé dans le journal d'audit BUUPP ».",
      },
      {
        version: "1.2",
        date: "2026-05-15",
        summary:
          "L'email révélé au Pro est désormais un alias `prospect+rXXX@buupp.com` propre à la relation. Le vrai email du prospect n'est jamais exposé. Toute fuite est imputée nominativement au Pro émetteur.",
      },
    ],
  },
  {
    slug: "rgpd",
    href: "/rgpd",
    title: "Politique RGPD",
    section: "legal",
    history: [
      { version: "1.0", date: INITIAL_RELEASE, summary: "Version initiale." },
      {
        version: "1.1",
        date: "2026-05-15",
        summary:
          "Section « Prévention de la fraude » réécrite pour décrire les mesures réellement en place (contraintes d'unicité base, exclusivité de rôle, journal d'audit verrouillé) au lieu de « watermarking » et « alertes anti-exfiltration ».",
      },
      {
        version: "1.2",
        date: "2026-05-15",
        summary:
          "Ajout du watermark cryptographique sur les emails révélés (alias unique par relation, routage via Cloudflare Email Routing, table `relation_email_aliases` verrouillée RLS).",
      },
    ],
  },
  {
    slug: "cookies",
    href: "/cookies",
    title: "Politique des cookies",
    section: "legal",
    history: [
      { version: "1.0", date: INITIAL_RELEASE, summary: "Version initiale." },
    ],
  },
  {
    slug: "contact-dpo",
    href: "/contact-dpo",
    title: "Contact DPO",
    section: "legal",
    history: [
      { version: "1.0", date: INITIAL_RELEASE, summary: "Version initiale." },
    ],
  },
];

export function getPageMeta(slug: PageSlug): PageMeta {
  const meta = PAGE_VERSIONS.find((p) => p.slug === slug);
  if (!meta) {
    throw new Error(`page-versions: slug inconnu « ${slug} »`);
  }
  return meta;
}

export function getCurrentVersion(slug: PageSlug): VersionEntry {
  const meta = getPageMeta(slug);
  return meta.history[meta.history.length - 1];
}
