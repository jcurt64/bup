"use client";

import { useCallback, useRef, useState } from "react";
import type { TutorialVideo } from "@/lib/videos/catalog";

/**
 * Lecteur vidéo « mis en situation » : la capture paysage est encadrée dans une
 * fenêtre de navigateur, ce qui situe le contexte d'un coup d'œil. La capture
 * portrait, elle, embarque déjà son cadre d'appareil — on la laisse telle
 * quelle plutôt que d'empiler deux mockups.
 *
 * Lecture au clic uniquement (jamais d'autoplay) : le poster tient lieu
 * d'affiche, les contrôles natifs n'apparaissent qu'une fois lancé pour ne
 * pas alourdir la mise en page au repos. `preload="metadata"` → seules
 * quelques dizaines de Ko partent tant que personne ne clique.
 */

export function DeviceVideo({
  video,
  index,
  onPlay,
  registerRef,
}: {
  video: TutorialVideo;
  index: number;
  onPlay?: (id: string) => void;
  registerRef?: (id: string, el: HTMLVideoElement | null) => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [started, setStarted] = useState(false);

  const start = useCallback(() => {
    setStarted(true);
    onPlay?.(video.id);
    // play() peut être rejeté (onglet en arrière-plan, politique de lecture) :
    // on absorbe le rejet, l'utilisateur relancera via les contrôles natifs.
    void ref.current?.play().catch(() => {});
  }, [onPlay, video.id]);

  const isPhone = video.orientation === "portrait";

  return (
    <figure style={{ margin: 0 }}>
      <div
        style={{
          position: "relative",
          margin: "0 auto",
          maxWidth: isPhone ? 330 : 760,
          // La capture paysage est plein cadre : on lui dessine une fenêtre de
          // navigateur pour situer le contexte. La capture portrait embarque
          // déjà son propre cadre d'appareil (mockup Screen Studio) — lui en
          // ajouter un second ferait cadre-dans-le-cadre.
          background: "#141C2E",
          borderRadius: isPhone ? 22 : 14,
          padding: 0,
          boxShadow: "0 30px 60px -30px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.06)",
          overflow: "hidden",
        }}
      >
        {!isPhone && (
          <div
            aria-hidden
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 12px",
              background: "#1B2233",
              borderBottom: "1px solid rgba(255,255,255,.07)",
            }}
          >
            <Dot color="#FF5F57" />
            <Dot color="#FEBC2E" />
            <Dot color="#28C840" />
            <span
              style={{
                marginLeft: 10,
                padding: "3px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,.07)",
                color: "rgba(251,249,243,.55)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                letterSpacing: ".04em",
              }}
            >
              buupp.com
            </span>
          </div>
        )}

        <div style={{ position: "relative", lineHeight: 0 }}>
          <video
            ref={(el) => {
              ref.current = el;
              registerRef?.(video.id, el);
            }}
            src={video.src}
            poster={video.poster}
            width={video.width}
            height={video.height}
            controls={started}
            preload="metadata"
            playsInline
            onPlay={() => {
              setStarted(true);
              onPlay?.(video.id);
            }}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              borderRadius: isPhone ? 22 : 0,
              background: "#0B1220",
            }}
          >
            Votre navigateur ne peut pas lire cette vidéo.{" "}
            <a href={video.src}>Télécharger le fichier</a>.
          </video>

          {!started && (
            <button
              type="button"
              onClick={start}
              aria-label={`Lire la vidéo : ${video.titre}`}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: 0,
                cursor: "pointer",
                borderRadius: isPhone ? 22 : 0,
                background:
                  "linear-gradient(180deg, rgba(11,18,32,.05) 0%, rgba(11,18,32,.45) 100%)",
              }}
            >
              <span
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(251,249,243,.94)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 30px -8px rgba(0,0,0,.6)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 0,
                    height: 0,
                    marginLeft: 5,
                    borderTop: "11px solid transparent",
                    borderBottom: "11px solid transparent",
                    borderLeft: "18px solid #141C2E",
                  }}
                />
              </span>
            </button>
          )}
        </div>
      </div>

      <figcaption style={{ marginTop: 18, textAlign: "center" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "#A5B4FC",
            fontWeight: 600,
          }}
        >
          {String(index + 1).padStart(2, "0")} · {video.support} · {video.duree}
        </span>
        <h3
          className="serif"
          style={{
            margin: "8px 0 0",
            fontSize: "clamp(19px, 2.2vw, 23px)",
            fontWeight: 500,
            color: "var(--paper)",
            letterSpacing: "-0.01em",
          }}
        >
          {video.titre}
        </h3>
        <p
          style={{
            margin: "8px auto 0",
            maxWidth: 420,
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "rgba(251,249,243,.62)",
          }}
        >
          {video.chapo}
        </p>
      </figcaption>
    </figure>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "block" }}
    />
  );
}

/**
 * Groupe de lecteurs qui s'excluent mutuellement : lancer une vidéo met
 * l'autre en pause. Sans ça, deux bandes-son se superposent — et sur mobile
 * deux flux se disputent la bande passante.
 */
export function VideoGroup({ videos }: { videos: TutorialVideo[] }) {
  const refs = useRef<Map<string, HTMLVideoElement | null>>(new Map());

  const registerRef = useCallback((id: string, el: HTMLVideoElement | null) => {
    refs.current.set(id, el);
  }, []);

  const onPlay = useCallback((id: string) => {
    for (const [otherId, el] of refs.current) {
      if (otherId !== id && el && !el.paused) el.pause();
    }
  }, []);

  return (
    <>
      {videos.map((v, i) => (
        <DeviceVideo
          key={v.id}
          video={v}
          index={i}
          onPlay={onPlay}
          registerRef={registerRef}
        />
      ))}
    </>
  );
}
