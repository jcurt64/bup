import type { Metadata } from "next";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";

/* ─── Page publique : les vidéos « comment s'inscrire » ─────────────
   Cible : les inscrits de la liste d'attente qui reçoivent le mail de
   lancement (audience « waitlist » du composer admin). Le mail ne peut
   pas lire une vidéo — il affiche une vignette cliquable qui pointe ici.

   Hébergement volontairement interne (fichiers servis depuis /public,
   balise <video> native) : pas d'embed YouTube/Vimeo, donc aucun cookie
   ni requête tiers — cohérent avec la promesse « vos données vous
   appartiennent » et avec la page /cookies (aucun traceur hors mesure
   consentie).

   Pour ajouter/remplacer une vidéo : déposer le .mp4 et son image
   poster dans public/videos/ puis ajuster VIDEOS ci-dessous. Une entrée
   dont le fichier est absent affiche simplement un lecteur vide — rien
   ne casse le rendu de la page. */

export const metadata: Metadata = {
  title: "Tutoriels — s'inscrire sur BUUPP",
  description:
    "Deux vidéos courtes qui montrent comment s'inscrire sur la liste d'attente BUUPP et comment parrainer vos proches.",
};

type Tutorial = {
  /** Ancre ciblée depuis le mail : /tutoriels#video-1 */
  id: string;
  numero: string;
  titre: string;
  duree: string;
  chapo: string;
  src: string;
  poster: string;
};

const VIDEOS: Tutorial[] = [
  {
    id: "video-1",
    numero: "01",
    titre: "S'inscrire depuis un ordinateur",
    duree: "1 min 15",
    chapo:
      "Le formulaire de pré-inscription, étape par étape : prénom, ville, centres d'intérêt. Aucune donnée sensible à ce stade, et rien n'est transmis à un professionnel.",
    src: "/videos/pre-inscription-ordinateur.mp4",
    poster: "/videos/pre-inscription-ordinateur.jpg",
  },
  {
    id: "video-2",
    numero: "02",
    titre: "S'inscrire depuis un téléphone",
    duree: "1 min 30",
    chapo:
      "Le même parcours sur mobile, du premier écran à la confirmation de votre place — avec le lien de parrainage à partager une fois inscrit·e.",
    src: "/videos/pre-inscription-mobile.mp4",
    poster: "/videos/pre-inscription-mobile.jpg",
  },
];

export default function TutorielsPage() {
  return (
    <main
      style={{
        background: "var(--ivory)",
        color: "var(--ink)",
        minHeight: "100vh",
        padding: "40px 20px 72px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <BackHomeButton />

        <header style={{ margin: "28px 0 36px" }}>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent)",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Tutoriels
          </p>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(28px, 5vw, 40px)",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              margin: "10px 0 0",
              fontWeight: 500,
            }}
          >
            S&apos;inscrire sur BUUPP, en deux vidéos
          </h1>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              color: "var(--ink-3)",
              margin: "14px 0 0",
              maxWidth: 620,
            }}
          >
            Moins de deux minutes en tout. Rien à installer, rien à payer&nbsp;: la
            pré-inscription réserve votre place et vos avantages fondateur avant
            l&apos;ouverture officielle.
          </p>
        </header>

        <div style={{ display: "grid", gap: 32 }}>
          {VIDEOS.map((v) => (
            <section
              key={v.id}
              id={v.id}
              style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-lg)",
                padding: 18,
                boxShadow: "var(--shadow-card)",
                // Décale l'ancre sous le haut de fenêtre quand on arrive
                // depuis /tutoriels#video-2.
                scrollMarginTop: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--accent)",
                    fontWeight: 700,
                  }}
                >
                  {v.numero}
                </span>
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: 22,
                    fontWeight: 500,
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {v.titre}
                </h2>
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--ink-4)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {v.duree}
                </span>
              </div>

              <p
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.6,
                  color: "var(--ink-3)",
                  margin: "0 0 14px",
                }}
              >
                {v.chapo}
              </p>

              {/* controls + preload metadata : rien ne se télécharge tant que
                  l'utilisateur n'a pas lancé la lecture. */}
              <video
                controls
                preload="metadata"
                poster={v.poster}
                playsInline
                style={{
                  width: "100%",
                  display: "block",
                  borderRadius: "var(--radius-md)",
                  background: "var(--ink)",
                  aspectRatio: "16 / 9",
                }}
              >
                <source src={v.src} type="video/mp4" />
                Votre navigateur ne peut pas lire cette vidéo.{" "}
                <a href={v.src}>Télécharger le fichier</a>.
              </video>
            </section>
          ))}
        </div>

        <div
          style={{
            marginTop: 36,
            padding: "22px 20px",
            background: "var(--accent-soft)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-lg)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 14px",
              fontSize: 15.5,
              lineHeight: 1.6,
              color: "var(--ink-2)",
            }}
          >
            Prêt·e&nbsp;? La pré-inscription prend deux minutes.
          </p>
          <Link
            href="/liste-attente"
            style={{
              display: "inline-block",
              padding: "13px 28px",
              background: "var(--ink)",
              color: "var(--paper)",
              borderRadius: 999,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Je réserve ma place →
          </Link>
        </div>
      </div>
    </main>
  );
}
