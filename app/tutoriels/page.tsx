import type { Metadata } from "next";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";
import { VideoGroup } from "../_components/VideoShowcase";
import { TUTORIAL_VIDEOS } from "@/lib/videos/catalog";

/* ─── Page publique : la bibliothèque de vidéos ─────────────────────
   Destination du bouton « Vidéos » du header et des vignettes du mail
   d'annonce (ancres /tutoriels#video-1, #video-2).

   Hébergement volontairement interne (fichiers servis depuis /public,
   balise <video> native) : pas d'embed YouTube/Vimeo, donc aucun cookie
   ni requête tiers — cohérent avec la promesse « vos données vous
   appartiennent » et avec la page /cookies (aucun traceur hors mesure
   consentie).

   Pour publier une vidéo : déposer le .mp4 + son poster .jpg dans
   public/videos/ puis ajouter une entrée dans lib/videos/catalog. */

export const metadata: Metadata = {
  title: "Vidéos — comprendre BUUPP",
  description:
    "Les vidéos qui montrent BUUPP en fonctionnement : le parcours de pré-inscription sur ordinateur et sur téléphone, sans montage qui embellit.",
};

export default function TutorielsPage() {
  return (
    <main
      style={{
        background: "var(--ink)",
        color: "var(--paper)",
        minHeight: "100vh",
        padding: "40px 20px 80px",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <BackHomeButton />

        <header style={{ margin: "32px 0 52px", maxWidth: 720 }}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "#A5B4FC",
              fontWeight: 600,
            }}
          >
            ▶ Vidéos
          </p>
          <h1
            className="serif"
            style={{
              margin: "14px 0 0",
              fontSize: "clamp(30px, 5vw, 46px)",
              lineHeight: 1.1,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              // globals.css force `color: var(--ink)` sur les titres : sur
              // fond encre, il faut le réécrire explicitement.
              color: "var(--paper)",
            }}
          >
            BUUPP en fonctionnement
          </h1>
          <p
            style={{
              margin: "18px 0 0",
              fontSize: "clamp(15.5px, 1.7vw, 18px)",
              lineHeight: 1.65,
              color: "rgba(251,249,243,.68)",
            }}
          >
            De vraies captures de l&apos;interface, sans montage qui embellit.
            Cette bibliothèque s&apos;étoffera au fil des fonctionnalités —
            revenez-y quand une étape vous paraît obscure.
          </p>
        </header>

        {TUTORIAL_VIDEOS.length === 0 ? (
          <p style={{ color: "rgba(251,249,243,.6)" }}>
            Les premières vidéos arrivent très bientôt.
          </p>
        ) : (
          <div className="grid grid-2" style={{ gap: 48, alignItems: "start" }}>
            <VideoGroup videos={TUTORIAL_VIDEOS} />
          </div>
        )}

        <div
          style={{
            marginTop: 60,
            padding: "26px 24px",
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: "var(--radius-lg)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 15.5,
              lineHeight: 1.6,
              color: "rgba(251,249,243,.8)",
            }}
          >
            Prêt·e&nbsp;? La pré-inscription prend deux minutes.
          </p>
          <Link
            href="/liste-attente"
            style={{
              display: "inline-block",
              padding: "13px 28px",
              background: "var(--paper)",
              color: "var(--ink)",
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
