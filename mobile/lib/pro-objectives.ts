// Catalogue des objectifs de campagne — porté à l'identique du dashboard web
// (public/prototype/components/Pro.jsx → OBJECTIVES). 7 objectifs, chacun
// avec ses sous-opérations (id, nom, description, coût indicatif € / contact).
import type { Ionicons } from "@expo/vector-icons";

export type CampaignSubType = {
  id: string;
  name: string;
  desc: string;
  cost: number;
};

export type CampaignObjective = {
  id: string;
  name: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  allowedTiers: number[];
  sub: CampaignSubType[];
};

export const OBJECTIVES: CampaignObjective[] = [
  {
    id: "contact",
    name: "Prise de contact direct",
    desc: "8 opérations — email, SMS, push, appel, WhatsApp",
    icon: "mail-outline",
    allowedTiers: [1],
    sub: [
      { id: "email", name: "Email marketing", desc: "Newsletter, campagne promotionnelle, séquence de bienvenue", cost: 0.15 },
      { id: "sms", name: "SMS marketing", desc: "Message promotionnel, alerte offre, rappel personnalisé", cost: 0.2 },
      { id: "mms", name: "MMS marketing", desc: "Message multimédia avec image ou vidéo courte", cost: 0.25 },
      { id: "postal", name: "Mailing postal", desc: "Courrier physique personnalisé, catalogue, carte postale", cost: 0.8 },
      { id: "phone", name: "Phoning / Cold calling", desc: "Appel téléphonique de prospection sortante", cost: 0.5 },
      { id: "wa", name: "WhatsApp Business", desc: "Message direct via canal messaging instantané", cost: 0.25 },
      { id: "pushweb", name: "Push notification web", desc: "Notification navigateur envoyée à un abonné consentant", cost: 0.1 },
      { id: "pushapp", name: "Push notification app", desc: "Notification mobile sur application installée", cost: 0.1 },
    ],
  },
  {
    id: "rdv",
    name: "Prise de rendez-vous",
    desc: "6 opérations — physique, visio, devis, essai",
    icon: "calendar-outline",
    allowedTiers: [1],
    sub: [
      { id: "rdvphys", name: "RDV physique commercial", desc: "Rencontre en face-à-face chez le prospect ou en agence", cost: 2.0 },
      { id: "rdvtel", name: "RDV téléphonique", desc: "Appel qualifié planifié avec un conseiller ou commercial", cost: 1.0 },
      { id: "rdvvisio", name: "RDV visioconférence", desc: "Réunion en ligne via Teams, Zoom ou Google Meet", cost: 0.8 },
      { id: "consult", name: "Consultation gratuite", desc: "Bilan offert en échange de coordonnées (coach, kiné…)", cost: 1.5 },
      { id: "devis", name: "Devis à domicile", desc: "Visite technique pour établir un chiffrage (BTP, énergie)", cost: 3.0 },
      { id: "essai", name: "Essai produit planifié", desc: "Test drive, essai cuisine, démo logiciel avec commercial", cost: 2.5 },
    ],
  },
  {
    id: "evt",
    name: "Événementiel & inscription",
    desc: "8 opérations — webinar, atelier, conférence",
    icon: "flag-outline",
    allowedTiers: [1, 2, 3, 4, 5],
    sub: [
      { id: "webinar", name: "Webinar / conférence web", desc: "Événement en ligne éducatif ou commercial", cost: 1.0 },
      { id: "portes", name: "Portes ouvertes", desc: "Visite libre des locaux, découverte de l’offre", cost: 1.2 },
      { id: "atelier", name: "Atelier / workshop", desc: "Événement pratique en petit groupe, en présentiel", cost: 2.0 },
      { id: "conf", name: "Conférence / intervention", desc: "Prise de parole d’expert devant un public cible", cost: 1.5 },
      { id: "network", name: "Soirée client / networking", desc: "Événement de fidélisation ou prospection en soirée", cost: 2.0 },
      { id: "demo", name: "Démo produit collective", desc: "Présentation d’un produit à un groupe d’invités", cost: 1.5 },
      { id: "launch", name: "Lancement produit", desc: "Événement dédié à la révélation d’une nouveauté", cost: 2.5 },
      { id: "tournoi", name: "Tournoi / challenge", desc: "Compétition sponsorisée autour d’un thème produit", cost: 1.2 },
    ],
  },
  {
    id: "dl",
    name: "Contenus à télécharger",
    desc: "9 opérations — livre blanc, guide, étude",
    icon: "download-outline",
    allowedTiers: [1],
    sub: [
      { id: "wb", name: "Livre blanc", desc: "Guide expert sur un sujet thématique avec valeur perçue élevée", cost: 1.0 },
      { id: "etude", name: "Étude de cas", desc: "Résultat client concret présenté sous forme narrative", cost: 1.2 },
      { id: "cat", name: "Fiche produit / catalogue", desc: "Descriptif commercial téléchargeable", cost: 0.5 },
      { id: "guide", name: "Guide pratique", desc: "Tutoriel ou aide à la décision pour le prospect", cost: 0.8 },
      { id: "info", name: "Infographie", desc: "Contenu visuel résumant un sujet ou une statistique", cost: 0.6 },
      { id: "rapport", name: "Rapport / baromètre", desc: "Étude de marché annuelle ou sectorielle", cost: 1.5 },
      { id: "tpl", name: "Template / modèle", desc: "Outil prêt à l’emploi offert en échange d’un email", cost: 0.6 },
      { id: "check", name: "Checklist", desc: "Liste de contrôle pratique téléchargeable", cost: 0.4 },
      { id: "replay", name: "Replay vidéo", desc: "Enregistrement d’un webinar ou conférence passée", cost: 0.8 },
    ],
  },
  {
    id: "survey",
    name: "Études & collecte d’avis",
    desc: "8 opérations — NPS, sondage, focus group",
    icon: "clipboard-outline",
    allowedTiers: [1, 2, 3, 4, 5],
    sub: [
      { id: "csat", name: "Enquête satisfaction (CSAT)", desc: "Score de satisfaction sur une expérience récente", cost: 0.8 },
      { id: "nps", name: "Net Promoter Score (NPS)", desc: "Mesure de la propension à recommander la marque", cost: 0.8 },
      { id: "poll", name: "Sondage d’opinion", desc: "Questionnaire sur un sujet marché ou produit", cost: 0.5 },
      { id: "panel", name: "Étude de marché panel", desc: "Questionnaire rémunéré auprès d’un panel ciblé", cost: 1.5 },
      { id: "test", name: "Test produit utilisateur", desc: "Envoi d’un produit en échange d’un avis détaillé", cost: 2.0 },
      { id: "focus", name: "Groupe focus (focus group)", desc: "Réunion qualitative avec 6 à 12 participants", cost: 3.0 },
      { id: "interview", name: "Interview client", desc: "Entretien individuel approfondi sur un besoin", cost: 2.5 },
      { id: "vote", name: "Vote / élection produit", desc: "Participation à un choix (packaging, nom, design)", cost: 0.6 },
    ],
  },
  {
    id: "promo",
    name: "Promotions & fidélisation",
    desc: "4 opérations — coupon, flash, concours",
    icon: "pricetags-outline",
    allowedTiers: [1, 2, 3, 4, 5],
    sub: [
      { id: "coupon", name: "Offre de réduction ciblée", desc: "Coupon, code promo ou remise envoyé à un segment", cost: 0.3 },
      { id: "welcome", name: "Offre de bienvenue", desc: "Avantage exclusif à la première commande ou inscription", cost: 0.6 },
      { id: "flash", name: "Vente flash", desc: "Promotion à durée limitée pour créer l’urgence", cost: 0.5 },
      { id: "contest", name: "Concours / jeu-concours", desc: "Animation avec gain à la clé pour créer de l’engagement", cost: 0.8 },
    ],
  },
  {
    id: "addigital",
    name: "Publicité digitale",
    desc: "Adresses réseaux sociaux pour ciblage publicitaire",
    icon: "megaphone-outline",
    allowedTiers: [1, 2, 3, 4, 5],
    sub: [
      { id: "meta", name: "Audience Meta (Facebook / Instagram)", desc: "Liste d’emails / téléphones hashés pour ciblage publicitaire", cost: 0.2 },
      { id: "google", name: "Google Customer Match", desc: "Audience pour Google Ads, YouTube, Discovery", cost: 0.2 },
      { id: "tiktok", name: "TikTok Ads — Custom Audience", desc: "Liste pour ciblage publicitaire TikTok Ads", cost: 0.2 },
      { id: "linkedin", name: "LinkedIn Matched Audiences", desc: "Audience B2B pour LinkedIn Ads", cost: 0.3 },
      { id: "snap", name: "Snapchat Ads", desc: "Audience pour ciblage publicitaire Snap", cost: 0.2 },
      { id: "x", name: "X (Twitter) Ads", desc: "Liste pour ciblage publicitaire sur X", cost: 0.2 },
    ],
  },
];
