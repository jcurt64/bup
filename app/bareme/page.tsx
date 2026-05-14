"use client";

import { useState } from "react";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";
import PageVersion from "../_components/PageVersion";

type Category = { name: string; value: number; desc: string };
type Tier = {
  id: number;
  label: string;
  name: string;
  icon: string;
  color: string;
  baseMin: number;
  baseMax: number;
  verifiedMultiplier: number;
  categories: Category[];
  usage: string;
  rarity: string;
};

const TIERS: Tier[] = [
  {
    id: 1,
    label: "Palier 1",
    name: "Données d'Identification",
    icon: "◎",
    color: "#64748B",
    baseMin: 1.0,
    baseMax: 1.0,
    verifiedMultiplier: 2,
    categories: [
      { name: "Adresse e-mail", value: 1.0, desc: "Contact digital basique" },
      { name: "Prénom & Nom", value: 1.0, desc: "Identification nominale" },
      { name: "Numéro de téléphone", value: 1.0, desc: "Contact direct" },
      {
        name: "Date de naissance",
        value: 1.0,
        desc: "Segmentation démographique",
      },
      { name: "Genre", value: 1.0, desc: "Ciblage basique" },
      { name: "Nationalité", value: 1.0, desc: "Segmentation géographique" },
    ],
    usage: "Email marketing, SMS, relances commerciales basiques",
    rarity: "Très courant",
  },
  {
    id: 2,
    label: "Palier 2",
    name: "Données de Localisation",
    icon: "◉",
    color: "#3B82F6",
    baseMin: 1.0,
    baseMax: 2.0,
    verifiedMultiplier: 2,
    categories: [
      {
        name: "Adresse postale complète",
        value: 1.5,
        desc: "Géolocalisation précise",
      },
      { name: "Code postal / Ville", value: 1.0, desc: "Zone de chalandise" },
      { name: "Région / Département", value: 1.2, desc: "Ciblage régional" },
      {
        name: "Type de logement",
        value: 1.5,
        desc: "Propriétaire vs locataire",
      },
      { name: "Mobilité géographique", value: 1.7, desc: "Déménagement prévu" },
      {
        name: "Distance domicile-travail",
        value: 2.0,
        desc: "Habitudes de déplacement",
      },
    ],
    usage: "Ciblage géolocalisé, prospection locale, événements de proximité",
    rarity: "Courant",
  },
  {
    id: 3,
    label: "Palier 3",
    name: "Données de Style de Vie",
    icon: "●",
    color: "#10B981",
    baseMin: 2.0,
    baseMax: 3.5,
    verifiedMultiplier: 2,
    categories: [
      {
        name: "Centres d'intérêt déclarés",
        value: 2.0,
        desc: "Loisirs, hobbies",
      },
      {
        name: "Habitudes d'achat",
        value: 2.8,
        desc: "Fréquence & panier moyen",
      },
      {
        name: "Situation familiale",
        value: 2.4,
        desc: "Célibataire, marié(e), enfants",
      },
      {
        name: "Animaux de compagnie",
        value: 2.0,
        desc: "Propriétaire d'animaux",
      },
      { name: "Véhicule(s) possédé(s)", value: 3.5, desc: "Type & ancienneté" },
      {
        name: "Régime alimentaire",
        value: 2.4,
        desc: "Végétarien, sans gluten...",
      },
      { name: "Activité sportive", value: 2.0, desc: "Type & fréquence" },
    ],
    usage:
      "Personnalisation des offres, fidélisation, recommandations produits",
    rarity: "Moins courant",
  },
  {
    id: 4,
    label: "Palier 4",
    name: "Données Professionnelles",
    icon: "⬟",
    color: "#D97706",
    baseMin: 3.5,
    baseMax: 5.0,
    verifiedMultiplier: 2,
    categories: [
      {
        name: "Secteur d'activité",
        value: 3.5,
        desc: "Industrie, services, technologies...",
      },
      {
        name: "Intitulé du poste",
        value: 3.8,
        desc: "Manager, directeur, technicien...",
      },
      {
        name: "Ancienneté dans l'emploi",
        value: 3.5,
        desc: "Stabilité professionnelle",
      },
      {
        name: "Statut (salarié / indépendant)",
        value: 4.0,
        desc: "Nature du contrat",
      },
      {
        name: "Revenus annuels (tranche)",
        value: 4.7,
        desc: "Capacité d'achat estimée",
      },
      { name: "Niveau d'études", value: 3.8, desc: "Segmentation CSP" },
      {
        name: "Responsabilité d'achat B2B",
        value: 5.0,
        desc: "Décideur en entreprise",
      },
    ],
    usage: "Ciblage B2B, vente services premium, formation, investissement",
    rarity: "Rare",
  },
  {
    id: 5,
    label: "Palier 5",
    name: "Données Patrimoniales & Projets",
    icon: "★",
    color: "#A855F7",
    baseMin: 5.0,
    baseMax: 10.0,
    verifiedMultiplier: 2,
    categories: [
      {
        name: "Propriétaire immobilier",
        value: 7.0,
        desc: "Bien principal / investissement",
      },
      {
        name: "Épargne & placements",
        value: 8.0,
        desc: "Type de produits détenus",
      },
      {
        name: "Projet d'achat immobilier",
        value: 10.0,
        desc: "Budget & délai",
      },
      { name: "Crédit en cours", value: 6.0, desc: "Type & encours" },
      {
        name: "Patrimoine estimé (tranche)",
        value: 9.0,
        desc: "Segmentation premium",
      },
      {
        name: "Projet de création d'entreprise",
        value: 7.5,
        desc: "Entrepreneur potentiel",
      },
      {
        name: "Succession / héritage prévu",
        value: 8.5,
        desc: "Gestion de patrimoine",
      },
      {
        name: "Retraite proche (< 5 ans)",
        value: 6.5,
        desc: "Transition financière",
      },
    ],
    usage:
      "Banque privée, immobilier, gestion de patrimoine, assurance-vie, CGPI",
    rarity: "Très rare & très valorisé",
  },
];

const fmt = (v: number) => v.toFixed(2).replace(".", ",") + " €";

export default function BaremePage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [verified, setVerified] = useState(false);
  const [hoveredTier, setHoveredTier] = useState<number | null>(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--ivory)",
        color: "var(--ink)",
        fontFamily: "var(--sans)",
        padding: "56px 24px 120px",
      }}
    >
      <div style={{ position: "relative", maxWidth: 980, margin: "0 auto" }}>
        {/* Logo — cohérence avec les autres pages du footer (CGU, CGV, RGPD…) */}
        <Link
          href="/"
          aria-label="Retour à l'accueil BUUPP"
          style={{ display: "inline-block", marginBottom: 32, lineHeight: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="BUUPP"
            style={{ height: 44, width: "auto", display: "block" }}
          />
        </Link>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div
            className="serif"
            style={{
              display: "inline-block",
              fontSize: "clamp(40px, 7vw, 64px)",
              fontWeight: 400,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: "var(--ink)",
            }}
          >
            Barème <em style={{ color: "var(--accent)" }}>des paliers</em>
          </div>
          <div
            className="mono caps"
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "var(--accent)",
              marginTop: 16,
            }}
          >
            — MATRICE D&apos;EVALUATION DES DONNÉES
          </div>
          <div
            className="muted"
            style={{
              marginTop: 16,
              fontSize: "clamp(14px, 1.5vw, 16px)",
              maxWidth: 560,
              margin: "16px auto 0",
              lineHeight: 1.55,
            }}
          >
            Grille de valorisation des données personnelles par catégorie — 5
            paliers de rémunération prospect.
          </div>
          <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
            <PageVersion version="1.0" />
          </div>
        </div>

        {/* Toggle Prospect Vérifié */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginBottom: 40,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--ink-4)" }}>
            Prospect standard
          </span>
          <button
            onClick={() => setVerified((v) => !v)}
            aria-pressed={verified}
            style={{
              width: 56,
              height: 28,
              borderRadius: 14,
              cursor: "pointer",
              background: verified ? "var(--accent)" : "var(--ivory-2)",
              border: `1px solid ${verified ? "var(--accent)" : "var(--line-2)"}`,
              position: "relative",
              transition: "all 0.3s ease",
              padding: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 3,
                left: verified ? 30 : 3,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: verified ? "#FFF" : "var(--ink-5)",
                transition: "left 0.3s ease",
                boxShadow: verified ? "0 2px 8px rgba(79,70,229,0.35)" : "none",
              }}
            />
          </button>
          <span
            style={{
              fontSize: 13,
              color: verified ? "var(--accent)" : "var(--ink-4)",
              fontWeight: verified ? 600 : 400,
            }}
          >
            Prospect vérifié 100% <span style={{ fontSize: 11 }}>×2</span>
          </span>
        </div>

        {/* Tier Cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 40,
          }}
        >
          {TIERS.map((tier, idx) => {
            const isActive = selected === idx;
            const isHovered = hoveredTier === idx;
            const minVal = verified
              ? tier.baseMin * tier.verifiedMultiplier
              : tier.baseMin;
            const maxVal = verified
              ? tier.baseMax * tier.verifiedMultiplier
              : tier.baseMax;

            return (
              <div
                key={tier.id}
                onClick={() => setSelected(isActive ? null : idx)}
                onMouseEnter={() => setHoveredTier(idx)}
                onMouseLeave={() => setHoveredTier(null)}
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, ${tier.color}14, ${tier.color}06)`
                    : isHovered
                      ? "var(--paper)"
                      : "var(--paper)",
                  border: `1px solid ${
                    isActive
                      ? tier.color + "80"
                      : isHovered
                        ? tier.color + "40"
                        : "var(--line)"
                  }`,
                  borderRadius: 14,
                  padding: "20px 24px",
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  boxShadow: isActive
                    ? `0 0 24px ${tier.color}25`
                    : "0 1px 0 rgba(15,23,42,.04), 0 1px 2px rgba(15,23,42,.04)",
                }}
              >
                {/* Tier header row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: `${tier.color}14`,
                      border: `1px solid ${tier.color}40`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      color: tier.color,
                      flexShrink: 0,
                    }}
                  >
                    {tier.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        className="mono caps"
                        style={{
                          fontSize: 10,
                          color: tier.color,
                          letterSpacing: "0.18em",
                        }}
                      >
                        {tier.label}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: `${tier.color}12`,
                          color: tier.color,
                          border: `1px solid ${tier.color}30`,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {tier.rarity}
                      </span>
                    </div>
                    <div
                      className="serif"
                      style={{
                        fontSize: "clamp(17px, 2vw, 20px)",
                        fontWeight: 400,
                        color: "var(--ink)",
                        marginTop: 4,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {tier.name}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      className="mono tnum"
                      style={{
                        fontSize: 20,
                        fontWeight: 600,
                        color: tier.color,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {minVal === maxVal ? `min. ${fmt(minVal)}` : `${fmt(minVal)} – ${fmt(maxVal)}`}
                    </div>
                    {verified && (
                      <div
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: "var(--accent)",
                          marginTop: 2,
                        }}
                      >
                        ✦ Tarif vérifié (×2)
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      color: tier.color,
                      fontSize: 18,
                      marginLeft: 8,
                      flexShrink: 0,
                      transform: isActive ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.25s ease",
                    }}
                  >
                    ›
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    marginTop: 14,
                    height: 3,
                    background: "var(--line)",
                    borderRadius: 2,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 2,
                      background: `linear-gradient(90deg, ${tier.color}80, ${tier.color})`,
                      width: `${(tier.id / 5) * 100}%`,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>

                {/* Expanded content */}
                {isActive && (
                  <div style={{ marginTop: 24 }}>
                    <div
                      className="muted"
                      style={{
                        marginBottom: 16,
                        fontSize: 13,
                        fontStyle: "italic",
                      }}
                    >
                      💼 {tier.usage}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(260px, 1fr))",
                        gap: 10,
                      }}
                    >
                      {tier.categories.map((cat, ci) => {
                        const val = verified
                          ? cat.value * tier.verifiedMultiplier
                          : cat.value;
                        return (
                          <div
                            key={ci}
                            style={{
                              background: "var(--ivory-2)",
                              border: `1px solid ${tier.color}25`,
                              borderRadius: 8,
                              padding: "12px 14px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: 13,
                                  color: "var(--ink-2)",
                                  fontWeight: 500,
                                }}
                              >
                                {cat.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--ink-4)",
                                  marginTop: 2,
                                }}
                              >
                                {cat.desc}
                              </div>
                            </div>
                            <div
                              className="mono tnum"
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: tier.color,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmt(val)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary table */}
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "28px",
            marginBottom: 32,
          }}
        >
          <div
            className="mono caps"
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "var(--accent)",
              marginBottom: 20,
            }}
          >
            — Récapitulatif de la grille
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  {[
                    "Palier",
                    "Catégorie",
                    "Fourchette standard",
                    "Fourchette vérifié ×2",
                    "Rareté",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIERS.map((tier) => (
                  <tr key={tier.id}>
                    <td>
                      <span
                        className="mono"
                        style={{ color: tier.color, fontWeight: 600 }}
                      >
                        {tier.label}
                      </span>
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{tier.name}</td>
                    <td className="mono tnum" style={{ color: tier.color }}>
                      {tier.baseMin === tier.baseMax
                        ? `minimum ${fmt(tier.baseMin)}`
                        : `${fmt(tier.baseMin)} – ${fmt(tier.baseMax)}`}
                    </td>
                    <td
                      className="mono tnum"
                      style={{ color: "var(--accent)" }}
                    >
                      {tier.baseMin === tier.baseMax
                        ? `minimum ${fmt(tier.baseMin * 2)}`
                        : `${fmt(tier.baseMin * 2)} – ${fmt(tier.baseMax * 2)}`}
                    </td>
                    <td>
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: `${tier.color}12`,
                          color: tier.color,
                          border: `1px solid ${tier.color}30`,
                        }}
                      >
                        {tier.rarity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              icon: "◎",
              label: "Données standard",
              desc: "Large diffusion, faible différenciation",
              color: "#64748B",
            },
            {
              icon: "⬟",
              label: "Données professionnelles",
              desc: "Haute valeur B2B et segmentation CSP",
              color: "#D97706",
            },
            {
              icon: "★",
              label: "Données patrimoniales",
              desc: "Maximum de valeur — profils premium",
              color: "#A855F7",
            },
            {
              icon: "✦",
              label: "Multiplicateur ×2",
              desc: "Prospect vérifié Palier 3 — identité certifiée KYC",
              color: "#4F46E5",
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 18, color: item.color, flexShrink: 0 }}>
                {item.icon}
              </span>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--ink-2)",
                    fontWeight: 500,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}
                >
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer caption */}
        <div
          className="mono"
          style={{
            textAlign: "center",
            marginTop: 40,
            fontSize: 10,
            color: "var(--ink-5)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          PLATEFORME BUUPP — MATRICE D&apos;EVALUATION DES DONNÉES v1.0
        </div>

        {/* Bouton retour — cohérence avec CGU, CGV, RGPD, Contact DPO */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 28,
            borderTop: "1px solid var(--line)",
          }}
        >
          <BackHomeButton />
        </div>
      </div>
    </div>
  );
}
