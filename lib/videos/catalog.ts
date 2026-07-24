/**
 * Catalogue des vidéos pédagogiques publiées par BUUPP.
 *
 * Source unique consommée par :
 *   • la section « Familiarisez-vous avec BUUPP » de la page d'accueil
 *     (les `featured`, affichées en diptyque écran + téléphone) ;
 *   • la page /tutoriels (toutes les vidéos) ;
 *   • le mail d'annonce aux inscrits de la liste d'attente, dont les
 *     vignettes reprennent les mêmes `poster`.
 *
 * Vidéos auto-hébergées depuis `public/videos` (balise <video> native) :
 * aucun embed YouTube/Vimeo, donc aucun cookie ni requête tiers — cohérent
 * avec la page /cookies et la promesse « vos données vous appartiennent ».
 *
 * Pour publier une nouvelle vidéo : déposer le `.mp4` + son poster `.jpg`
 * dans `public/videos`, puis ajouter une entrée ici. Les dimensions sont
 * déclarées explicitement (le lecteur réserve la place avant chargement,
 * pas de saut de mise en page) — les relever avec
 * `swift scripts/extract-video-frame.swift <video> <s> <sortie.jpg>`.
 */

export type VideoOrientation = "paysage" | "portrait";

export type TutorialVideo = {
  /** Ancre stable, utilisée par /tutoriels#<id> depuis le mail. */
  id: string;
  titre: string;
  /** Une phrase : ce que la vidéo montre, pas ce qu'elle promet. */
  chapo: string;
  /** Libellé court affiché sur la vignette (« Sur ordinateur »). */
  support: string;
  duree: string;
  src: string;
  poster: string;
  width: number;
  height: number;
  orientation: VideoOrientation;
  /** Mise en avant sur la page d'accueil. */
  featured: boolean;
};

export const TUTORIAL_VIDEOS: TutorialVideo[] = [
  {
    id: "video-1",
    titre: "S'inscrire depuis un ordinateur",
    chapo:
      "Le parcours de pré-inscription du premier écran à la confirmation de votre place : prénom, ville, centres d'intérêt. Aucune donnée sensible à ce stade, et rien n'est transmis à un professionnel.",
    support: "Sur ordinateur",
    duree: "1 min 07",
    src: "/videos/pre-inscription-ordinateur.mp4",
    poster: "/videos/pre-inscription-ordinateur.jpg",
    width: 1316,
    height: 720,
    orientation: "paysage",
    featured: true,
  },
  {
    id: "video-2",
    titre: "S'inscrire depuis un téléphone",
    chapo:
      "Le même parcours, en version mobile — celle que vos proches utiliseront le plus, avec le lien de parrainage à partager une fois la place réservée.",
    support: "Sur téléphone",
    duree: "1 min 30",
    src: "/videos/pre-inscription-mobile.mp4",
    poster: "/videos/pre-inscription-mobile.jpg",
    width: 532,
    height: 720,
    orientation: "portrait",
    featured: true,
  },
];

export const FEATURED_VIDEOS = TUTORIAL_VIDEOS.filter((v) => v.featured);
