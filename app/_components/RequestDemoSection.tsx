"use client";

import { useState } from "react";
import DemoModal from "./DemoModal";
import { Icon } from "./SiteChrome";

/**
 * Section « Demander une démo » de la page Contact.
 *
 * Pitch + bénéfices à gauche, carte d'appel à l'action à droite. Le bouton
 * ouvre DemoModal (réservation cal.com en 30 min) — même composant que le CTA
 * démo de l'espace professionnel sur la page d'accueil.
 */
export default function RequestDemoSection() {
  const [demoOpen, setDemoOpen] = useState(false);

  const points: string[] = [
    "Tour guidé de la création de campagne et du ciblage par paliers de données.",
    "Démonstration du double consentement et de la pseudonymisation côté pro.",
    "Échange sur votre cas d'usage et estimation de coût au contact.",
  ];

  return (
    <section
      className="section"
      style={{ background: "var(--ivory)", borderTop: "1px solid var(--line)" }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div
          className="grid grid-2"
          style={{ gap: "clamp(32px, 5vw, 64px)", alignItems: "center" }}
        >
          {/* Colonne gauche : pitch + bénéfices */}
          <div>
            <div
              className="mono caps"
              style={{
                fontSize: 11,
                letterSpacing: ".18em",
                color: "var(--accent)",
                marginBottom: 16,
              }}
            >
              — Démo
            </div>
            <h2 className="serif" style={{ letterSpacing: "0.06em" }}>
              Découvrez BUUPP <em>en action</em>.
            </h2>
            <p
              className="muted"
              style={{
                fontSize: "clamp(15px, 1.6vw, 18px)",
                lineHeight: 1.6,
                marginTop: 20,
                maxWidth: 480,
              }}
            >
              Réservez 30 minutes avec notre équipe&nbsp;: on vous montre la
              plateforme en conditions réelles et on répond à toutes vos
              questions, sans engagement.
            </p>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "26px 0 0",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {points.map((p) => (
                <li
                  key={p}
                  style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
                >
                  <span
                    className="row center"
                    style={{
                      width: 24,
                      height: 24,
                      flex: "0 0 auto",
                      borderRadius: 7,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      marginTop: 1,
                    }}
                  >
                    <Icon name="check" size={14} stroke={2} />
                  </span>
                  <span style={{ fontSize: 15, lineHeight: 1.55, color: "var(--ink-3)" }}>
                    {p}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Colonne droite : carte d'appel à l'action —
              dégradé bleu nuit→violet, anneaux décoratifs, icône horloge. */}
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              background:
                "linear-gradient(158deg, #0E1430 0%, #181a44 56%, #241f5e 100%)",
              color: "var(--paper)",
              borderRadius: "var(--r-lg, 16px)",
              padding: "clamp(32px, 4vw, 48px)",
              textAlign: "center",
            }}
          >
            {/* Anneaux décoratifs */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: -90,
                right: -80,
                width: 300,
                height: 300,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,.08)",
                pointerEvents: "none",
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: -110,
                left: -90,
                width: 300,
                height: 300,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,.07)",
                pointerEvents: "none",
              }}
            />

            <div style={{ position: "relative" }}>
              {/* Icône horloge dans un carré violet */}
              <div
                className="row center"
                style={{
                  width: 56,
                  height: 56,
                  margin: "0 auto 22px",
                  justifyContent: "center",
                  borderRadius: 16,
                  background: "linear-gradient(150deg, #6d5cff, #4b3fd0)",
                  color: "#fff",
                  boxShadow: "0 12px 28px -10px rgba(124,92,255,.7)",
                }}
              >
                <Icon name="clock" size={26} />
              </div>
              <div
                className="serif"
                style={{ fontSize: "clamp(26px, 3vw, 34px)", lineHeight: 1.15 }}
              >
                30 minutes pour{" "}
                <em style={{ color: "#C4B5FD" }}>tout comprendre</em>.
              </div>
              <p
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,.66)",
                  margin: "16px auto 0",
                  maxWidth: 380,
                }}
              >
                Choisissez le créneau qui vous convient — la démo se fait en
                visio, directement depuis votre navigateur.
              </p>
              <button
                type="button"
                className="btn btn-lg"
                onClick={() => setDemoOpen(true)}
                style={{
                  marginTop: 28,
                  background: "var(--paper)",
                  color: "var(--ink)",
                  justifyContent: "center",
                }}
              >
                Demander une démo <Icon name="arrow" size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </section>
  );
}
