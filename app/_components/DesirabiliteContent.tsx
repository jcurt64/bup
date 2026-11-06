"use client";

/**
 * Indice de désirabilité (BUUPP Score) — contenu de la page
 * /indice-desirabilite. Auparavant présenté sur l'accueil sous forme de
 * scène épinglée (popups successifs au défilement) ; depuis le 06/11/2026 il
 * vit sur sa propre page, les trois volets (paliers, fraîcheur, fiabilité)
 * étant empilés en sections distinctes.
 */

import type { ReactNode } from "react";
import { Icon, type IconName } from "./SiteChrome";

function ScoreGauge({
  value = 742,
  max = 1000,
  size = 120,
  label = true,
}: {
  value?: number;
  max?: number;
  size?: number;
  label?: boolean;
}) {
  const pct = value / max;
  const R = size / 2 - 6;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - pct);
  const tone =
    value >= 800
      ? "#166534"
      : value >= 600
        ? "var(--accent)"
        : value >= 400
          ? "#A16207"
          : "#B91C1C";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={R}
          stroke="var(--line)"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={R}
          stroke={tone}
          strokeWidth="4"
          fill="none"
          strokeDasharray={C}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div
          className="serif tnum"
          style={{ fontSize: size * 0.28, lineHeight: 1, color: "var(--ink)" }}
        >
          {value}
        </div>
        {label && (
          <div
            className="mono muted"
            style={{ fontSize: 10, marginTop: 2, letterSpacing: "0.1em" }}
          >
            / {max}
          </div>
        )}
      </div>
    </div>
  );
}

function Progress({ value = 0.5, color }: { value?: number; color?: string }) {
  return (
    <div
      style={{
        height: 4,
        borderRadius: 2,
        background: "var(--line)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value * 100}%`,
          height: "100%",
          background: color || "var(--accent)",
          transition: "width .5s ease",
        }}
      />
    </div>
  );
}

function ScoreVisual() {
  const ranges: [string, string, string][] = [
    ["0–399", "Découverte", "#B91C1C"],
    ["400–699", "Solide", "#A16207"],
    ["700–899", "Recherché", "var(--accent)"],
    ["900–1000", "Prestige", "#166534"],
  ];
  const stats: [string, number][] = [
    ["Complétude des paliers", 85],
    ["Fraîcheur des données", 92],
    ["Taux de fiabilité", 90],
  ];
  return (
    <>
      <div
        className="grid grid-2"
        style={{ gap: 56, alignItems: "center" }}
      >
        <div>
          <div className="mono caps muted" style={{ marginBottom: 16 }}>
            — BUUPP Score
          </div>
          <h2
            className="serif"
            style={{ marginBottom: 20, letterSpacing: "0.08em" }}
          >
            Un indice de <em>désirabilité</em> transparent.
          </h2>
          <p
            className="muted"
            style={{
              fontSize: "clamp(15px, 1.5vw, 17px)",
              marginBottom: 24,
              maxWidth: 520,
            }}
          >
            Votre score évolue selon la complétude de vos paliers, la fraîcheur
            de vos données et votre taux de fiabilité. Un score élevé
            attire des demandes plus exigeantes et mieux rémunérées.
          </p>
          <div className="row gap-6 wrap">
            {ranges.map(([r, n, c], i) => (
              <div key={i} className="col gap-1">
                <div
                  className="mono tnum"
                  style={{ fontSize: 12, color: "var(--ink-4)" }}
                >
                  {r}
                </div>
                <div
                  style={{ fontSize: 15, fontFamily: "var(--serif)", color: c }}
                >
                  {n}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          className="card score-card"
          style={{ padding: "clamp(24px, 4vw, 48px)", textAlign: "center" }}
        >
          <div className="row center" style={{ justifyContent: "center" }}>
            <ScoreGauge value={742} size={180} />
          </div>
          <div className="serif" style={{ fontSize: 20, marginTop: 24 }}>
            Marie L. — <em>Recherchée</em>
          </div>
          <div
            className="muted"
            style={{ fontSize: 13, letterSpacing: "0.08em", marginTop: 4 }}
          >
            Profil vérifié · 3 paliers validés · 12 mises en relation
          </div>
          <div
            style={{
              marginTop: 28,
              borderTop: "1px solid var(--line)",
              paddingTop: 20,
              textAlign: "left",
            }}
          >
            {stats.map(([l, v], i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div
                  className="row between"
                  style={{
                    fontSize: 12,
                    marginBottom: 4,
                    letterSpacing: "0.06em",
                  }}
                >
                  <span
                    className="muted"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    {l}
                    {l === "Taux de fiabilité" && (
                      <a
                        href="#fiabilite"
                        aria-label="Comment se calcule votre taux de fiabilité ?"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "transparent",
                          border: 0,
                          padding: 0,
                          cursor: "pointer",
                          color: "var(--ink-4)",
                        }}
                      >
                        <Icon name="info" size={13} />
                      </a>
                    )}
                  </span>
                  <span className="mono tnum">{v}%</span>
                </div>
                <Progress value={v / 100} />
              </div>
            ))}
          </div>
        </div>
      </div>

    </>
  );
}

const SCORE_C = {
  card: "#fffdf8",
  ink: "#161a1d",
  ink2: "#3c444b",
  ink3: "#757d83",
  ink4: "#9aa0a4",
  line: "rgba(22,26,29,0.10)",
  paperWarm: "#efeadd",
  indigo: "#5a57d6",
  indigoD: "#4744bf",
  indigoSoft: "#ecebfb",
  indigoXsoft: "#f4f3fd",
  teal: "#1c8a6e",
  tealSoft: "#e9f5f0",
  amber: "#b9842a",
  amberSoft: "#faf4e6",
  rose: "#c14d77",
  roseSoft: "#f7e2ea",
  green: "#2e9e5b",
  greenSoft: "#dcf0e3",
} as const;

/* Carte popup partagée (chrome repris de la maquette pop.png). */
function ScorePopupCard({
  accent,
  icon,
  kicker,
  title,
  children,
  onClose,
}: {
  accent: string;
  icon: IconName;
  kicker: string;
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const C = SCORE_C;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 760,
        background: C.card,
        borderRadius: 18,
        border: `1px solid ${C.line}`,
        boxShadow: "0 18px 50px -24px rgba(22,26,29,0.28)",
        textAlign: "left",
      }}
    >
      <div style={{ height: 4, background: accent }} />
      <div style={{ padding: "clamp(20px, 4vw, 28px)" }}>
        <div className="row between" style={{ alignItems: "flex-start", gap: 12 }}>
          <div
            className="row"
            style={{ alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                background: C.indigoSoft,
                color: C.indigoD,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name={icon} size={18} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                className="mono caps"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  color: C.ink4,
                  marginBottom: 3,
                }}
              >
                {kicker}
              </div>
              <h3
                className="serif"
                style={{
                  fontSize: "clamp(18px, 2.4vw, 22px)",
                  margin: 0,
                  lineHeight: 1.2,
                  color: C.ink,
                }}
              >
                {title}
              </h3>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                border: `1px solid ${C.line}`,
                background: C.card,
                color: C.ink3,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/* Popup 1 — mécanisme des paliers (complétude). */
function PaliersBody() {
  const C = SCORE_C;
  // 5 marches : libellé, sous-titre, prix affiché, hauteur relative, couleur de barre.
  const steps: {
    n: number;
    label: string;
    sub: string;
    price: string;
    h: number;
    fill: string;
    top?: boolean;
  }[] = [
    { n: 1, label: "Identification", sub: "email, nom, tél.", price: "1,00 €", h: 60, fill: "#c7c5f1" },
    { n: 2, label: "Localisation", sub: "adresse, logement", price: "2,00 €", h: 88, fill: "#a9a6ea" },
    { n: 3, label: "Style de vie", sub: "habitudes, famille", price: "3,50 €", h: 116, fill: "#8b88e2" },
    { n: 4, label: "Professionnel", sub: "statut, secteur", price: "5,00 €", h: 144, fill: "#6764d6" },
    { n: 5, label: "Patrimoine", sub: "immobilier, projets", price: "10 €", h: 176, fill: "#4a47bf", top: true },
  ];
  return (
    <>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.ink2, margin: "16px 0 16px" }}>
        Vos données sont rangées en{" "}
        <strong style={{ color: C.ink }}>cinq paliers cloisonnés</strong>, de
        l&apos;identification aux centres d&apos;intérêt. Plus vous montez de marches,
        plus chaque palier est <strong style={{ color: C.ink }}>rémunéré</strong> — et
        plus vous décrochez le sommet.
      </p>
      {/* Graphique en escalier */}
      <div
        style={{
          position: "relative",
          borderRadius: 14,
          padding: "14px 14px 12px",
          background:
            "radial-gradient(160px 120px at 87% 12%, rgba(244,205,95,0.24), rgba(244,205,95,0) 70%), linear-gradient(180deg, #f6f5fd 0%, #edecfb 100%)",
          border: `1px solid ${C.indigoSoft}`,
        }}
      >
        <div
          className="mono caps"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.1em",
            color: C.indigoD,
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 10,
          }}
        >
          <span aria-hidden style={{ fontSize: 12 }}>
            ↗
          </span>
          + de rémunération à chaque marche
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 236 }}>
          {steps.map((s) => (
            <div
              key={s.n}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
              }}
            >
              {/* Pastille prix */}
              <div
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: s.top ? 4 : 3,
                  marginBottom: 10,
                  padding: s.top ? "3px 12px" : "3px 8px",
                  borderRadius: 999,
                  background: s.top
                    ? "linear-gradient(180deg, #fff7e2 0%, #f6e1a8 100%)"
                    : "#fff",
                  border: s.top ? "1px solid #ecc873" : "none",
                  boxShadow: s.top
                    ? "0 6px 16px rgba(212,160,47,0.36)"
                    : "0 3px 8px rgba(71,68,191,0.18)",
                  fontSize: s.top ? 13 : 11.5,
                  fontWeight: 700,
                  color: s.top ? "#a3701a" : C.indigoD,
                  whiteSpace: "nowrap",
                }}
              >
                {s.top ? (
                  <>
                    <style>{`@keyframes bupp-twinkle{0%,100%{opacity:.25;transform:scale(.6)}50%{opacity:1;transform:scale(1.15)}}@media (prefers-reduced-motion:reduce){.bupp-spark{animation:none!important;opacity:.9}}`}</style>
                    <span>10</span>
                    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          inset: -7,
                          borderRadius: "50%",
                          background:
                            "radial-gradient(circle, rgba(245,205,90,0.75), rgba(245,205,90,0) 70%)",
                        }}
                      />
                      <span className="bupp-spark" style={{ position: "absolute", top: -9, left: -9, color: "#e0a72f", display: "inline-flex", animation: "bupp-twinkle 1.8s ease-in-out infinite" }}>
                        <Icon name="sparkle" size={11} />
                      </span>
                      <span className="bupp-spark" style={{ position: "absolute", top: -10, right: -8, color: "#eebb45", display: "inline-flex", animation: "bupp-twinkle 1.8s ease-in-out .5s infinite" }}>
                        <Icon name="sparkle" size={8} />
                      </span>
                      <span className="bupp-spark" style={{ position: "absolute", bottom: -7, right: -9, color: "#eebb45", display: "inline-flex", animation: "bupp-twinkle 1.8s ease-in-out .9s infinite" }}>
                        <Icon name="sparkle" size={6} />
                      </span>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="#c9881d" aria-hidden style={{ position: "relative" }}>
                        <path d="M18 5V3H6v2H2v3a5 5 0 0 0 5 5h.6A6 6 0 0 0 11 15.9V18H8v2h8v-2h-3v-2.1A6 6 0 0 0 16.4 13H17a5 5 0 0 0 5-5V5h-4zM6 11a3 3 0 0 1-3-3V7h3v4zm15-3a3 3 0 0 1-3 3V7h3v1z" />
                      </svg>
                    </span>
                    <span>€</span>
                  </>
                ) : (
                  s.price
                )}
              </div>
              {/* Barre */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: s.h,
                  borderRadius: "9px 9px 0 0",
                  background: s.fill,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  paddingTop: 9,
                }}
              >
                <span
                  className="serif"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.92)",
                    color: C.indigoD,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                  }}
                >
                  {s.n}
                </span>
              </div>
            </div>
          ))}
        </div>
        {/* Libellés sous les marches */}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {steps.map((s) => (
            <div key={s.n} style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 9.5, color: C.ink4, lineHeight: 1.25, marginTop: 1 }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="row" style={{ gap: 11, alignItems: "flex-start", margin: "16px 0 16px" }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: C.indigoXsoft,
            color: C.indigoD,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="target" size={15} />
        </span>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: C.ink2, margin: 0 }}>
          La <strong style={{ color: C.indigoD }}>complétude</strong> mesure la part de
          paliers validés. Chaque marche gravie fait monter votre indice de désirabilité
          et débloque des sollicitations mieux rémunérées.
        </p>
      </div>
      <div
        className="row"
        style={{
          gap: 11,
          alignItems: "center",
          padding: "13px 15px",
          borderRadius: 12,
          background: C.greenSoft,
          border: `1px solid color-mix(in oklab, ${C.green} 22%, ${C.line})`,
        }}
      >
        <span style={{ color: C.green, display: "inline-flex", flexShrink: 0 }}>
          <Icon name="check" size={17} />
        </span>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: C.ink2, margin: 0 }}>
          <strong style={{ color: C.ink }}>Plus vous complétez de paliers</strong>, plus
          vous recevez de sollicitations — et mieux rémunérées.
        </p>
      </div>
    </>
  );
}

/* Popup 2 — fraîcheur des données. */
function FraicheurBody() {
  const C = SCORE_C;
  // Trois jalons de la courbe : position x (sur 320), y (sur 160), valeur, couleur.
  const pts: { x: number; y: number; n: string; color: string; soft: string; label: string; sub: string; hero?: boolean }[] = [
    { x: 54, y: 52, n: "100", color: C.green, soft: C.greenSoft, label: "Récentes", sub: "≤ 3 mois", hero: true },
    { x: 160, y: 92, n: "60", color: C.amber, soft: C.amberSoft, label: "À rafraîchir", sub: "3 – 12 mois" },
    { x: 266, y: 126, n: "20", color: C.rose, soft: C.roseSoft, label: "Périmées", sub: "> 12 mois" },
  ];
  return (
    <>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.ink2, margin: "16px 0 16px" }}>
        Une donnée récente inspire confiance. Avec le temps, sa valeur s&apos;érode&nbsp;:
        votre <strong style={{ color: C.ink }}>fraîcheur</strong> — et donc votre score —
        diminue si vos informations vieillissent, comme une feuille qui se fane.
      </p>
      {/* Courbe de décroissance */}
      <div
        style={{
          borderRadius: 14,
          padding: "12px 12px 10px",
          background: "linear-gradient(180deg, #fbfaf4 0%, #f3f0e5 100%)",
          border: `1px solid ${C.line}`,
        }}
      >
        <div className="row between" style={{ marginBottom: 2 }}>
          <span className="mono caps" style={{ fontSize: 9, letterSpacing: "0.12em", color: C.green }}>
            Fraîcheur
          </span>
          <span className="mono caps" style={{ fontSize: 9, letterSpacing: "0.12em", color: C.ink4 }}>
            → Temps
          </span>
        </div>
        <svg viewBox="0 0 320 160" width="100%" height="auto" style={{ display: "block" }}>
          <defs>
            <linearGradient id="bupp-fresh" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={C.green} />
              <stop offset="0.5" stopColor={C.amber} />
              <stop offset="1" stopColor={C.rose} />
            </linearGradient>
            <radialGradient id="bupp-fresh-glow">
              <stop offset="0" stopColor={C.green} stopOpacity={0.42} />
              <stop offset="70%" stopColor={C.green} stopOpacity={0} />
            </radialGradient>
          </defs>
          <style>{`@keyframes bupp-twinkle{0%,100%{opacity:.25;transform:scale(.6)}50%{opacity:1;transform:scale(1.15)}}@media (prefers-reduced-motion:reduce){.bupp-spark{animation:none!important;opacity:.9}}`}</style>
          {pts.map((p) => (
            <line
              key={`g${p.x}`}
              x1={p.x}
              y1={p.y}
              x2={p.x}
              y2={146}
              stroke="rgba(22,26,29,0.10)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ))}
          <path
            d="M26 44 C 70 52, 80 72, 120 80 C 160 88, 175 100, 200 108 C 235 119, 262 124, 296 130"
            fill="none"
            stroke="url(#bupp-fresh)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          {pts.map((p) => (
            <g key={`p${p.x}`}>
              {p.hero && <circle cx={p.x} cy={p.y} r={32} fill="url(#bupp-fresh-glow)" />}
              <text
                x={p.x}
                y={p.y - 22}
                textAnchor="middle"
                fill={p.color}
                style={{ fontFamily: "var(--serif)", fontSize: "23px", fontWeight: 600 }}
              >
                {p.n}
              </text>
              <g transform={`translate(${p.x} ${p.y})`}>
                <circle r={15} fill="#fff" stroke={p.color} strokeWidth={1.5} />
                <path
                  d="M0 -7 C5.5 -3.5, 5.5 3.5, 0 8 C-5.5 3.5, -5.5 -3.5, 0 -7 Z"
                  fill={p.soft}
                  stroke={p.color}
                  strokeWidth={1.2}
                />
                <path d="M0 -5 L0 6.5" fill="none" stroke={p.color} strokeWidth={1.1} />
              </g>
              {p.hero &&
                [
                  { dx: -24, dy: -16, s: 1.4, c: "#2e9e5b", d: "0s" },
                  { dx: 20, dy: -20, s: 1.05, c: "#46bd72", d: ".45s" },
                  { dx: 25, dy: 9, s: 0.85, c: "#46bd72", d: ".9s" },
                  { dx: -20, dy: 15, s: 0.75, c: "#7ed29a", d: "1.3s" },
                ].map((sp, k) => (
                  <g key={k} transform={`translate(${p.x + sp.dx} ${p.y + sp.dy}) scale(${sp.s})`}>
                    <path
                      className="bupp-spark"
                      style={{
                        animation: `bupp-twinkle 1.8s ease-in-out ${sp.d} infinite`,
                        transformBox: "fill-box",
                        transformOrigin: "center",
                      }}
                      fill={sp.c}
                      d="M0 -5 C.6 -1.6 1.6 -.6 5 0 C1.6 .6 .6 1.6 0 5 C-.6 1.6 -1.6 .6 -5 0 C-1.6 -.6 -.6 -1.6 0 -5 Z"
                    />
                  </g>
                ))}
            </g>
          ))}
        </svg>
        <div style={{ display: "flex", marginTop: 4 }}>
          {pts.map((p) => (
            <div key={`l${p.x}`} style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: p.color }}>{p.label}</div>
              <div style={{ fontSize: 10, color: C.ink4, marginTop: 1 }}>{p.sub}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="row" style={{ gap: 11, alignItems: "flex-start", margin: "16px 0 16px" }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: C.indigoXsoft,
            color: C.indigoD,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="trend" size={15} />
        </span>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: C.ink2, margin: 0 }}>
          La fraîcheur se recalcule en continu&nbsp;: un simple passage pour{" "}
          <strong style={{ color: C.indigoD }}>confirmer vos données</strong> suffit à la
          faire remonter au maximum.
        </p>
      </div>
      <div
        className="row"
        style={{
          gap: 11,
          alignItems: "center",
          padding: "13px 15px",
          borderRadius: 12,
          background: C.greenSoft,
          border: `1px solid color-mix(in oklab, ${C.green} 22%, ${C.line})`,
        }}
      >
        <span style={{ color: C.green, display: "inline-flex", flexShrink: 0 }}>
          <Icon name="check" size={17} />
        </span>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: C.ink2, margin: 0 }}>
          <strong style={{ color: C.ink }}>Des données à jour</strong>&nbsp;= un score
          stable et des sollicitations qui continuent d&apos;affluer.
        </p>
      </div>
    </>
  );
}

/* Popup 3 — taux de fiabilité (contenu d'origine, partagé avec le modal info). */
function FiabiliteBody() {
  const C = SCORE_C;
  // Sliders d'exemples : valeur 20→100 mappée sur 0→100 % (60 = neutre, au centre).
  const rows: { t: string; val: number; color: string }[] = [
    { t: "Aucun avis", val: 60, color: "#9aa0a4" },
    { t: "1 avis « Haute »", val: 70, color: C.indigo },
    { t: "10 avis « Haute »", val: 91, color: C.green },
  ];
  return (
    <>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.ink2, margin: "16px 0 16px" }}>
        Après une mise en relation, le professionnel attribue une note&nbsp;:{" "}
        <strong style={{ color: C.rose }}>Basse</strong>,{" "}
        <strong style={{ color: C.amber }}>Moyenne</strong> ou{" "}
        <strong style={{ color: C.green }}>Haute</strong>. La jauge ci-dessous traduit
        ces avis en un seul taux de confiance.
      </p>
      {/* Jauge */}
      <div
        style={{
          borderRadius: 14,
          padding: "12px 12px 8px",
          background: "linear-gradient(180deg, #faf9f3 0%, #f1efe5 100%)",
          border: `1px solid ${C.line}`,
        }}
      >
        <svg viewBox="0 0 280 182" width="100%" height="auto" style={{ display: "block" }}>
          <style>{`@keyframes bupp-rev{0%{transform:rotate(0deg)}9%{transform:rotate(-31deg)}24%{transform:rotate(27deg)}39%{transform:rotate(-21deg)}54%{transform:rotate(18deg)}69%{transform:rotate(-11deg)}82%{transform:rotate(7deg)}92%{transform:rotate(-3deg)}100%{transform:rotate(0deg)}}@media (prefers-reduced-motion:reduce){.bupp-needle{animation:none!important}}`}</style>
          {/* Arcs */}
          <path d="M60 140 A80 80 0 0 1 100 70.7" fill="none" stroke={C.rose} strokeWidth={15} strokeLinecap="round" />
          <path d="M100 70.7 A80 80 0 0 1 180 70.7" fill="none" stroke={C.amber} strokeWidth={15} strokeLinecap="round" />
          <path d="M180 70.7 A80 80 0 0 1 220 140" fill="none" stroke={C.green} strokeWidth={15} strokeLinecap="round" />
          {/* Libellés des zones (hors des arcs) */}
          <text x={30} y={118} textAnchor="middle" fill={C.rose} style={{ fontSize: "11px", fontWeight: 700 }}>Basse</text>
          <text x={30} y={135} textAnchor="middle" fill={C.rose} style={{ fontFamily: "var(--serif)", fontSize: "16px" }}>20</text>
          <text x={140} y={26} textAnchor="middle" fill={C.amber} style={{ fontSize: "11px", fontWeight: 700 }}>Moyenne</text>
          <text x={140} y={44} textAnchor="middle" fill={C.amber} style={{ fontFamily: "var(--serif)", fontSize: "16px" }}>60</text>
          <text x={250} y={118} textAnchor="middle" fill={C.green} style={{ fontSize: "11px", fontWeight: 700 }}>Haute</text>
          <text x={250} y={135} textAnchor="middle" fill={C.green} style={{ fontFamily: "var(--serif)", fontSize: "16px" }}>100</text>
          {/* Aiguille (pointe vers le neutre = 60, à la verticale) */}
          <g
            className="bupp-needle"
            style={{
              transformOrigin: "140px 140px",
              transformBox: "view-box",
              animation: "bupp-rev 2.6s cubic-bezier(.45,0,.55,1) infinite",
            }}
          >
            <polygon points="133,140 147,140 140,70" fill={C.ink} />
          </g>
          <circle cx={140} cy={140} r={9} fill={C.ink} />
          <circle cx={140} cy={140} r={3.5} fill="#fff" />
          {/* Valeur centrale */}
          <text x={140} y={164} textAnchor="middle" fill={C.ink3} style={{ fontSize: "11px", fontWeight: 600 }}>60 / 100</text>
          <text x={140} y={177} textAnchor="middle" fill={C.ink4} style={{ fontSize: "8.5px", letterSpacing: "0.14em" }}>DÉPART NEUTRE</text>
        </svg>
      </div>
      <div className="row" style={{ gap: 11, alignItems: "flex-start", margin: "16px 0 14px" }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: C.indigoXsoft,
            color: C.indigoD,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M2 13c2.5-5 4.5-5 7 0s4.5 5 7 0 4-4 6-2" />
          </svg>
        </span>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: C.ink2, margin: 0 }}>
          Le taux est une <strong style={{ color: C.indigoD }}>moyenne bayésienne</strong>
          &nbsp;: avec peu d&apos;avis l&apos;aiguille reste ancrée près du neutre, puis
          elle converge vers la vraie moyenne à mesure que les avis s&apos;accumulent.
        </p>
      </div>
      {/* Légende des exemples */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 4,
          marginBottom: 14,
        }}
      >
        <span className="mono caps" style={{ fontSize: 8.5, letterSpacing: "0.1em", color: C.ink4 }}>
          Plus d&apos;avis « Haute » → l&apos;aiguille monte
        </span>
        <span className="mono caps" style={{ fontSize: 8.5, letterSpacing: "0.1em", color: C.ink4 }}>
          → converge vers <strong style={{ color: C.indigoD }}>la vraie moyenne</strong>
        </span>
      </div>
      {/* Sliders */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map((r) => {
          const pct = ((r.val - 20) / 80) * 100;
          return (
            <div key={r.t} className="row" style={{ alignItems: "center", gap: 12 }}>
              <div
                style={{
                  flex: "0 0 33%",
                  maxWidth: 130,
                  minWidth: 0,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: C.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.t}
              </div>
              <div style={{ flex: 1, position: "relative", height: 8, minWidth: 70 }}>
                <span
                  className="mono caps"
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: -13,
                    transform: "translateX(-50%)",
                    fontSize: 8,
                    letterSpacing: "0.08em",
                    color: C.ink4,
                  }}
                >
                  neutre
                </span>
                <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: C.paperWarm }} />
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: -3,
                    bottom: -3,
                    width: 1.5,
                    background: "rgba(22,26,29,0.22)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    borderRadius: 999,
                    background: r.color,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${pct}%`,
                    top: "50%",
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: "#fff",
                    border: `2px solid ${r.color}`,
                    transform: "translate(-50%, -50%)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                  }}
                />
              </div>
              <div
                className="serif"
                style={{ flex: "0 0 auto", fontSize: 20, color: r.color, minWidth: 26, textAlign: "right" }}
              >
                {r.val}
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="row"
        style={{
          gap: 11,
          alignItems: "center",
          marginTop: 16,
          padding: "13px 15px",
          borderRadius: 12,
          background: C.greenSoft,
          border: `1px solid color-mix(in oklab, ${C.green} 22%, ${C.line})`,
        }}
      >
        <span style={{ color: C.green, display: "inline-flex", flexShrink: 0 }}>
          <Icon name="check" size={17} />
        </span>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: C.ink2, margin: 0 }}>
          <strong style={{ color: C.ink }}>Plus vous honorez vos mises en relation</strong>,
          plus votre fiabilité monte.
        </p>
      </div>
    </>
  );
}

const DESIR_POPUPS: {
  key: string;
  accent: string;
  icon: IconName;
  kicker: string;
  title: string;
  body: ReactNode;
}[] = [
  {
    key: "paliers",
    accent: "linear-gradient(90deg, #4744bf 0%, #7d79dd 45%, #d4a02f 100%)",
    icon: "lock",
    kicker: "Indice de désirabilité · 1 / 3",
    title: "Cinq paliers, un prix par palier",
    body: <PaliersBody />,
  },
  {
    key: "fraicheur",
    accent: "linear-gradient(90deg, #1c8a6e 0%, #5a57d6 50%, #b9842a 100%)",
    icon: "clock",
    kicker: "Indice de désirabilité · 2 / 3",
    title: "Des données fraîches valent plus",
    body: <FraicheurBody />,
  },
  {
    key: "fiabilite",
    accent: "linear-gradient(90deg, #4744bf 0%, #5a57d6 40%, #2e9e5b 100%)",
    icon: "shield",
    kicker: "Indice de désirabilité · 3 / 3",
    title: "Comment se calcule votre taux de fiabilité ?",
    body: <FiabiliteBody />,
  },
];

export default function DesirabiliteContent() {
  return (
    <>
      <section className="section">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <ScoreVisual />
        </div>
      </section>
      {DESIR_POPUPS.map((pp) => (
        <section
          key={pp.key}
          id={pp.key}
          className="section"
          style={{ paddingTop: 0, scrollMarginTop: 96 }}
        >
          <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", justifyContent: "center" }}>
            <ScorePopupCard
              accent={pp.accent}
              icon={pp.icon}
              kicker={pp.kicker}
              title={pp.title}
            >
              {pp.body}
            </ScorePopupCard>
          </div>
        </section>
      ))}
    </>
  );
}
