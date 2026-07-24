"use client";

import Link from "next/link";
import { FEATURED_VIDEOS } from "@/lib/videos/catalog";
import { VideoGroup } from "./VideoShowcase";

/**
 * Section « Familiarisez-vous avec BUUPP » — dernier bloc avant le pied de
 * page. Fond encre : les deux lecteurs sont posés comme sur un écran de
 * projection, et la rupture visuelle avec l'ivoire du reste de la page
 * signale qu'on change de registre (on montre, on n'argumente plus).
 *
 * Le contenu vient de lib/videos/catalog : ajouter une vidéo `featured` la
 * fait apparaître ici sans toucher à ce fichier.
 */
export default function VideoLearnSection() {
  if (FEATURED_VIDEOS.length === 0) return null;

  return (
    <section
      id="videos"
      className="section"
      style={{
        background: "var(--ink)",
        color: "var(--paper)",
        borderTop: "1px solid var(--line)",
        // Quadrillage discret : rappelle le fond du héros sans le copier.
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ maxWidth: 720, marginBottom: 56 }}>
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
            ▶ Mode d&apos;emploi
          </p>
          <h2
            className="serif"
            style={{
              margin: "14px 0 0",
              fontSize: "clamp(30px, 4.4vw, 46px)",
              lineHeight: 1.1,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: "var(--paper)",
            }}
          >
            Familiarisez-vous avec BUUPP
          </h2>
          <p
            style={{
              margin: "18px 0 0",
              fontSize: "clamp(15.5px, 1.7vw, 18px)",
              lineHeight: 1.65,
              color: "rgba(251,249,243,.68)",
            }}
          >
            Le même parcours, filmé deux fois&nbsp;: sur ordinateur et sur téléphone.
            Celui que vous ferez, et celui que vous montrerez à vos proches. Rien
            n&apos;est joué&nbsp;: ce sont de vraies captures de l&apos;interface, sans
            montage qui embellit.
          </p>
        </header>

        <div className="grid grid-2" style={{ gap: 48, alignItems: "start" }}>
          <VideoGroup videos={FEATURED_VIDEOS} />
        </div>

        <div
          style={{
            marginTop: 56,
            paddingTop: 28,
            borderTop: "1px solid rgba(255,255,255,.1)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 14.5,
              lineHeight: 1.6,
              color: "rgba(251,249,243,.55)",
              maxWidth: 520,
            }}
          >
            D&apos;autres vidéos suivront&nbsp;: chaque étape du parcours aura la
            sienne, du premier palier de données au retrait de vos gains.
          </p>
          <Link
            href="/tutoriels"
            className="btn btn-lg"
            style={{
              background: "var(--paper)",
              color: "var(--ink)",
              border: "1px solid var(--paper)",
              whiteSpace: "nowrap",
            }}
          >
            Toutes les vidéos →
          </Link>
        </div>
      </div>
    </section>
  );
}
