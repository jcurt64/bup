import { useState } from "react";

const TIERS = [
  {
    id: 1,
    label: "Palier 1",
    name: "Données d'Identification",
    icon: "◎",
    color: "#94A3B8",
    colorLight: "#F1F5F9",
    colorDark: "#64748B",
    baseMin: 0.10,
    baseMax: 0.50,
    verifiedMultiplier: 2,
    categories: [
      { name: "Adresse e-mail", value: 0.10, desc: "Contact digital basique" },
      { name: "Prénom & Nom", value: 0.15, desc: "Identification nominale" },
      { name: "Numéro de téléphone", value: 0.20, desc: "Contact direct" },
      { name: "Date de naissance", value: 0.25, desc: "Segmentation démographique" },
      { name: "Genre", value: 0.15, desc: "Ciblage basique" },
      { name: "Nationalité", value: 0.20, desc: "Segmentation géographique" },
    ],
    usage: "Email marketing, SMS, relances commerciales basiques",
    rarity: "Très courant",
  },
  {
    id: 2,
    label: "Palier 2",
    name: "Données de Localisation",
    icon: "◉",
    color: "#60A5FA",
    colorLight: "#EFF6FF",
    colorDark: "#3B82F6",
    baseMin: 0.50,
    baseMax: 2.00,
    verifiedMultiplier: 2,
    categories: [
      { name: "Adresse postale complète", value: 0.80, desc: "Géolocalisation précise" },
      { name: "Code postal / Ville", value: 0.50, desc: "Zone de chalandise" },
      { name: "Région / Département", value: 0.60, desc: "Ciblage régional" },
      { name: "Type de logement", value: 1.00, desc: "Propriétaire vs locataire" },
      { name: "Mobilité géographique", value: 1.20, desc: "Déménagement prévu" },
      { name: "Distance domicile-travail", value: 1.50, desc: "Habitudes de déplacement" },
    ],
    usage: "Ciblage géolocalisé, prospection locale, événements de proximité",
    rarity: "Courant",
  },
  {
    id: 3,
    label: "Palier 3",
    name: "Données de Style de Vie",
    icon: "●",
    color: "#34D399",
    colorLight: "#ECFDF5",
    colorDark: "#10B981",
    baseMin: 2.00,
    baseMax: 5.00,
    verifiedMultiplier: 2,
    categories: [
      { name: "Centres d'intérêt déclarés", value: 2.00, desc: "Loisirs, hobbies" },
      { name: "Habitudes d'achat", value: 3.00, desc: "Fréquence & panier moyen" },
      { name: "Situation familiale", value: 2.50, desc: "Célibataire, marié(e), enfants" },
      { name: "Animaux de compagnie", value: 2.00, desc: "Propriétaire d'animaux" },
      { name: "Véhicule(s) possédé(s)", value: 3.50, desc: "Type & ancienneté" },
      { name: "Régime alimentaire", value: 2.50, desc: "Végétarien, sans gluten..." },
      { name: "Activité sportive", value: 2.00, desc: "Type & fréquence" },
    ],
    usage: "Personnalisation des offres, fidélisation, recommandations produits",
    rarity: "Moins courant",
  },
  {
    id: 4,
    label: "Palier 4",
    name: "Données Professionnelles",
    icon: "⬟",
    color: "#F59E0B",
    colorLight: "#FFFBEB",
    colorDark: "#D97706",
    baseMin: 5.00,
    baseMax: 8.00,
    verifiedMultiplier: 2,
    categories: [
      { name: "Secteur d'activité", value: 5.00, desc: "Industrie, services, santé..." },
      { name: "Intitulé du poste", value: 5.50, desc: "Manager, directeur, technicien..." },
      { name: "Ancienneté dans l'emploi", value: 5.00, desc: "Stabilité professionnelle" },
      { name: "Statut (salarié / indépendant)", value: 6.00, desc: "Nature du contrat" },
      { name: "Revenus annuels (tranche)", value: 7.50, desc: "Capacité d'achat estimée" },
      { name: "Niveau d'études", value: 5.50, desc: "Segmentation CSP" },
      { name: "Responsabilité d'achat B2B", value: 8.00, desc: "Décideur en entreprise" },
    ],
    usage: "Ciblage B2B, vente services premium, formation, investissement",
    rarity: "Rare",
  },
  {
    id: 5,
    label: "Palier 5",
    name: "Données Patrimoniales & Projets",
    icon: "★",
    color: "#C084FC",
    colorLight: "#FAF5FF",
    colorDark: "#A855F7",
    baseMin: 8.00,
    baseMax: 10.00,
    verifiedMultiplier: 2,
    categories: [
      { name: "Propriétaire immobilier", value: 8.50, desc: "Bien principal / investissement" },
      { name: "Épargne & placements", value: 9.00, desc: "Type de produits détenus" },
      { name: "Projet d'achat immobilier", value: 10.00, desc: "Budget & délai" },
      { name: "Crédit en cours", value: 8.50, desc: "Type & encours" },
      { name: "Patrimoine estimé (tranche)", value: 9.50, desc: "Segmentation premium" },
      { name: "Projet de création d'entreprise", value: 9.00, desc: "Entrepreneur potentiel" },
      { name: "Succession / héritage prévu", value: 9.00, desc: "Gestion de patrimoine" },
      { name: "Retraite proche (< 5 ans)", value: 8.00, desc: "Transition financière" },
    ],
    usage: "Banque privée, immobilier, gestion de patrimoine, assurance-vie, CGPI",
    rarity: "Très rare & très valorisé",
  },
];

const fmt = (v) => v.toFixed(2).replace(".", ",") + " €";

export default function BuppMatrix() {
  const [selected, setSelected] = useState(null);
  const [verified, setVerified] = useState(false);
  const [hoveredTier, setHoveredTier] = useState(null);

  const activeTier = selected !== null ? TIERS[selected] : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0B0F1A",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: "#E2E8F0",
      padding: "40px 24px",
    }}>
      {/* Background texture */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.08) 0%, transparent 60%),
                          radial-gradient(ellipse at 80% 80%, rgba(168,85,247,0.06) 0%, transparent 60%)`,
        pointerEvents: "none"
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 980, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-block",
            background: "linear-gradient(135deg, #6366F1, #A855F7)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            fontSize: 52, fontWeight: 700, letterSpacing: "-2px",
            lineHeight: 1,
          }}>BUPP</div>
          <div style={{ fontSize: 13, letterSpacing: "6px", color: "#6366F1", textTransform: "uppercase", marginTop: 4, fontFamily: "monospace" }}>
            Data Valuation Matrix
          </div>
          <div style={{ marginTop: 16, fontSize: 15, color: "#94A3B8", maxWidth: 520, margin: "16px auto 0" }}>
            Grille de valorisation des données personnelles par catégorie — 5 paliers de rémunération prospect
          </div>
        </div>

        {/* Toggle Prospect Vérifié */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 16, marginBottom: 40,
        }}>
          <span style={{ fontSize: 14, color: "#94A3B8" }}>Prospect standard</span>
          <div
            onClick={() => setVerified(v => !v)}
            style={{
              width: 56, height: 28, borderRadius: 14, cursor: "pointer",
              background: verified
                ? "linear-gradient(135deg, #6366F1, #A855F7)"
                : "#1E2435",
              border: `1px solid ${verified ? "#6366F1" : "#334155"}`,
              position: "relative", transition: "all 0.3s ease",
            }}
          >
            <div style={{
              position: "absolute", top: 3,
              left: verified ? 30 : 3,
              width: 22, height: 22, borderRadius: "50%",
              background: verified ? "#FFF" : "#475569",
              transition: "left 0.3s ease",
              boxShadow: verified ? "0 2px 8px rgba(99,102,241,0.5)" : "none",
            }} />
          </div>
          <span style={{ fontSize: 14, color: verified ? "#A855F7" : "#94A3B8", fontWeight: verified ? 600 : 400 }}>
            Prospect vérifié 100% ✦ <span style={{ fontSize: 12 }}>×2</span>
          </span>
        </div>

        {/* Tier Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
          {TIERS.map((tier, idx) => {
            const isActive = selected === idx;
            const isHovered = hoveredTier === idx;
            const minVal = verified ? tier.baseMin * tier.verifiedMultiplier : tier.baseMin;
            const maxVal = verified ? tier.baseMax * tier.verifiedMultiplier : tier.baseMax;

            return (
              <div
                key={tier.id}
                onClick={() => setSelected(isActive ? null : idx)}
                onMouseEnter={() => setHoveredTier(idx)}
                onMouseLeave={() => setHoveredTier(null)}
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, ${tier.color}18, ${tier.color}08)`
                    : isHovered ? "#141828" : "#0F1420",
                  border: `1px solid ${isActive ? tier.color + "60" : isHovered ? tier.color + "30" : "#1E2435"}`,
                  borderRadius: 12,
                  padding: "20px 24px",
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  boxShadow: isActive ? `0 0 24px ${tier.color}20` : "none",
                }}
              >
                {/* Tier header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  {/* Icon & label */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: `${tier.color}20`,
                    border: `1px solid ${tier.color}50`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, color: tier.color, flexShrink: 0,
                  }}>{tier.icon}</div>

                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: tier.color, fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase" }}>
                        {tier.label}
                      </span>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 4,
                        background: `${tier.color}15`, color: tier.color,
                        border: `1px solid ${tier.color}30`, fontFamily: "monospace",
                      }}>{tier.rarity}</span>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#E2E8F0", marginTop: 2 }}>
                      {tier.name}
                    </div>
                  </div>

                  {/* Value range */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: tier.color, fontFamily: "monospace", letterSpacing: "-1px" }}>
                      {fmt(minVal)} – {fmt(maxVal)}
                    </div>
                    {verified && (
                      <div style={{ fontSize: 11, color: "#A855F7", fontFamily: "monospace" }}>
                        ✦ Tarif vérifié (×2)
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <div style={{
                    color: tier.color, fontSize: 18, marginLeft: 8, flexShrink: 0,
                    transform: isActive ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.25s ease",
                  }}>›</div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 14, height: 3, background: "#1E2435", borderRadius: 2 }}>
                  <div style={{
                    height: "100%", borderRadius: 2,
                    background: `linear-gradient(90deg, ${tier.color}80, ${tier.color})`,
                    width: `${(tier.id / 5) * 100}%`,
                    transition: "width 0.4s ease",
                  }} />
                </div>

                {/* Expanded content */}
                {isActive && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ marginBottom: 16, fontSize: 13, color: "#94A3B8", fontStyle: "italic" }}>
                      💼 {tier.usage}
                    </div>

                    {/* Data items grid */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: 10,
                    }}>
                      {tier.categories.map((cat, ci) => {
                        const val = verified ? cat.value * tier.verifiedMultiplier : cat.value;
                        return (
                          <div key={ci} style={{
                            background: "#0B0F1A",
                            border: `1px solid ${tier.color}25`,
                            borderRadius: 8,
                            padding: "12px 14px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                          }}>
                            <div>
                              <div style={{ fontSize: 13, color: "#CBD5E1", fontWeight: 600 }}>{cat.name}</div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{cat.desc}</div>
                            </div>
                            <div style={{
                              fontSize: 15, fontWeight: 700, color: tier.color,
                              fontFamily: "monospace", whiteSpace: "nowrap",
                            }}>{fmt(val)}</div>
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
        <div style={{
          background: "#0F1420",
          border: "1px solid #1E2435",
          borderRadius: 12,
          padding: "28px 28px",
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 13, letterSpacing: "4px", color: "#6366F1", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 20 }}>
            Récapitulatif de la grille
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Palier", "Catégorie", "Fourchette standard", "Fourchette vérifié ×2", "Rareté"].map(h => (
                    <th key={h} style={{
                      textAlign: "left", padding: "8px 12px",
                      color: "#64748B", fontWeight: 600, fontFamily: "monospace",
                      fontSize: 11, letterSpacing: "1px", textTransform: "uppercase",
                      borderBottom: "1px solid #1E2435",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIERS.map((tier, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1E2435" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ color: tier.color, fontWeight: 700 }}>{tier.label}</span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#CBD5E1" }}>{tier.name}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: tier.color }}>
                      {fmt(tier.baseMin)} – {fmt(tier.baseMax)}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#A855F7" }}>
                      {fmt(tier.baseMin * 2)} – {fmt(tier.baseMax * 2)}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 4,
                        background: `${tier.color}15`, color: tier.color,
                        border: `1px solid ${tier.color}30`, fontFamily: "monospace",
                      }}>{tier.rarity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}>
          {[
            { icon: "◎", label: "Données standard", desc: "Large diffusion, faible différenciation", color: "#94A3B8" },
            { icon: "⬟", label: "Données professionnelles", desc: "Haute valeur B2B et segmentation CSP", color: "#F59E0B" },
            { icon: "★", label: "Données patrimoniales", desc: "Maximum de valeur — profils premium", color: "#C084FC" },
            { icon: "✦", label: "Multiplicateur ×2", desc: "Prospect vérifié Palier 3 — identité certifiée KYC", color: "#6366F1" },
          ].map((item, i) => (
            <div key={i} style={{
              background: "#0F1420", border: "1px solid #1E2435",
              borderRadius: 8, padding: "14px 16px",
              display: "flex", alignItems: "flex-start", gap: 12,
            }}>
              <span style={{ fontSize: 18, color: item.color, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, color: "#CBD5E1", fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 40, fontSize: 11, color: "#334155", fontFamily: "monospace", letterSpacing: "2px" }}>
          BUPP PLATFORM — MATRICE D EVALUATION DES DONNÉES v1.0 — CONFIDENTIEL
        </div>
      </div>
    </div>
  );
}
