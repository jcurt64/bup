"use client";

import { useState } from "react";
import Link from "next/link";
import BackHomeButton from "../_components/BackHomeButton";
import PageVersion from "../_components/PageVersion";

/* ─── Source unique : objectifs + paliers de minimisation ───────────
   Données dupliquées depuis le wizard de création de campagne
   (Pro.jsx) — quand un pro choisit un objectif, BUUPP n'autorise que
   les paliers de données strictement nécessaires à cette finalité. */

type SubItem = { id: string; name: string; desc: string };
type Objective = {
  id: string;
  name: string;
  icon: string;
  short: string;
  allowedTiers: number[];
  sub: SubItem[];
};

const OBJECTIVES: Objective[] = [
  {
    id: "contact",
    name: "Prise de contact direct",
    icon: "✉",
    short: "Email, SMS, push, appel, WhatsApp",
    allowedTiers: [1],
    sub: [
      { id: "email", name: "Email marketing", desc: "Newsletter, campagne promo, séquence de bienvenue" },
      { id: "sms", name: "SMS marketing", desc: "Message promo, alerte offre, rappel personnalisé" },
      { id: "mms", name: "MMS marketing", desc: "Message multimédia avec image ou vidéo courte" },
      { id: "postal", name: "Mailing postal", desc: "Courrier physique personnalisé, catalogue" },
      { id: "phone", name: "Phoning / Cold calling", desc: "Appel téléphonique de prospection sortante" },
      { id: "wa", name: "WhatsApp Business", desc: "Message direct via canal messaging instantané" },
      { id: "pushweb", name: "Push notification web", desc: "Notification navigateur à un abonné consentant" },
      { id: "pushapp", name: "Push notification app", desc: "Notification mobile sur application installée" },
    ],
  },
  {
    id: "rdv",
    name: "Prise de rendez-vous",
    icon: "📅",
    short: "Physique, visio, devis, essai",
    allowedTiers: [1],
    sub: [
      { id: "rdvphys", name: "RDV physique commercial", desc: "Rencontre en face-à-face chez le prospect ou en agence" },
      { id: "rdvtel", name: "RDV téléphonique", desc: "Appel qualifié planifié avec un conseiller" },
      { id: "rdvvisio", name: "RDV visioconférence", desc: "Réunion en ligne via Teams, Zoom ou Google Meet" },
      { id: "consult", name: "Consultation gratuite", desc: "Bilan offert en échange de coordonnées" },
      { id: "devis", name: "Devis à domicile", desc: "Visite technique pour établir un chiffrage" },
      { id: "essai", name: "Essai produit planifié", desc: "Test drive, essai cuisine, démo logiciel" },
    ],
  },
  {
    id: "evt",
    name: "Événementiel & inscription",
    icon: "⚑",
    short: "Webinar, atelier, conférence",
    allowedTiers: [1, 2, 3, 4, 5],
    sub: [
      { id: "webinar", name: "Webinar / conférence web", desc: "Événement en ligne éducatif ou commercial" },
      { id: "portes", name: "Portes ouvertes", desc: "Visite libre des locaux" },
      { id: "atelier", name: "Atelier / workshop", desc: "Événement pratique en petit groupe" },
      { id: "conf", name: "Conférence / intervention", desc: "Prise de parole d'expert" },
      { id: "network", name: "Soirée client / networking", desc: "Événement de fidélisation ou prospection" },
      { id: "demo", name: "Démo produit collective", desc: "Présentation d'un produit à un groupe" },
      { id: "launch", name: "Lancement produit", desc: "Événement dédié à la révélation d'une nouveauté" },
      { id: "tournoi", name: "Tournoi / challenge", desc: "Compétition sponsorisée autour d'un thème produit" },
    ],
  },
  {
    id: "dl",
    name: "Contenus à télécharger",
    icon: "⬇",
    short: "Livre blanc, guide, étude",
    allowedTiers: [1],
    sub: [
      { id: "wb", name: "Livre blanc", desc: "Guide expert sur un sujet thématique" },
      { id: "etude", name: "Étude de cas", desc: "Résultat client concret en récit" },
      { id: "cat", name: "Fiche produit / catalogue", desc: "Descriptif commercial téléchargeable" },
      { id: "guide", name: "Guide pratique", desc: "Tutoriel ou aide à la décision" },
      { id: "info", name: "Infographie", desc: "Contenu visuel résumant un sujet" },
      { id: "rapport", name: "Rapport / baromètre", desc: "Étude de marché annuelle ou sectorielle" },
      { id: "tpl", name: "Template / modèle", desc: "Outil prêt à l'emploi" },
      { id: "check", name: "Checklist", desc: "Liste de contrôle pratique" },
      { id: "replay", name: "Replay vidéo", desc: "Enregistrement d'un webinar passé" },
    ],
  },
  {
    id: "survey",
    name: "Études & collecte d'avis",
    icon: "✓",
    short: "NPS, sondage, focus group",
    allowedTiers: [1, 2, 3, 4, 5],
    sub: [
      { id: "csat", name: "Enquête satisfaction (CSAT)", desc: "Score sur une expérience récente" },
      { id: "nps", name: "Net Promoter Score (NPS)", desc: "Propension à recommander la marque" },
      { id: "poll", name: "Sondage d'opinion", desc: "Questionnaire sur un sujet marché ou produit" },
      { id: "panel", name: "Étude de marché panel", desc: "Questionnaire rémunéré auprès d'un panel ciblé" },
      { id: "test", name: "Test produit utilisateur", desc: "Envoi d'un produit en échange d'un avis" },
      { id: "focus", name: "Groupe focus", desc: "Réunion qualitative 6-12 participants" },
      { id: "interview", name: "Interview client", desc: "Entretien individuel approfondi" },
      { id: "vote", name: "Vote / élection produit", desc: "Participation à un choix (packaging, nom, design)" },
    ],
  },
  {
    id: "promo",
    name: "Promotions & fidélisation",
    icon: "⚡",
    short: "Coupon, flash, concours",
    allowedTiers: [1, 2, 3, 4, 5],
    sub: [
      { id: "coupon", name: "Offre de réduction ciblée", desc: "Coupon ou remise envoyé à un segment" },
      { id: "welcome", name: "Offre de bienvenue", desc: "Avantage exclusif à la 1re commande" },
      { id: "flash", name: "Vente flash", desc: "Promotion à durée limitée" },
      { id: "contest", name: "Concours / jeu-concours", desc: "Animation avec gain à la clé" },
    ],
  },
  {
    id: "addigital",
    name: "Publicité digitale",
    icon: "◐",
    short: "Audiences réseaux sociaux",
    allowedTiers: [1, 2, 3, 4, 5],
    sub: [
      { id: "meta", name: "Audience Meta (FB / IG)", desc: "Liste d'emails / téléphones hashés" },
      { id: "google", name: "Google Customer Match", desc: "Audience pour Google Ads, YouTube" },
      { id: "tiktok", name: "TikTok Ads — Custom Audience", desc: "Liste pour ciblage publicitaire TikTok" },
      { id: "linkedin", name: "LinkedIn Matched Audiences", desc: "Audience B2B" },
      { id: "snap", name: "Snapchat Ads", desc: "Audience pour ciblage Snap" },
      { id: "x", name: "X (Twitter) Ads", desc: "Liste pour ciblage publicitaire sur X" },
    ],
  },
];

type Tier = {
  id: number;
  name: string;
  desc: string;
  examples: string;
  color: string;
};

const TIERS: Tier[] = [
  {
    id: 1,
    name: "Identification",
    desc: "Contact direct, identité minimale",
    examples: "Email, prénom/nom, téléphone, date de naissance, genre, nationalité",
    color: "#64748B",
  },
  {
    id: 2,
    name: "Localisation",
    desc: "Géolocalisation et habitation",
    examples: "Adresse postale, code postal, type de logement, mobilité",
    color: "#3B82F6",
  },
  {
    id: 3,
    name: "Style de vie",
    desc: "Habitudes personnelles, famille, loisirs",
    examples: "Famille, sport, véhicule, alimentation, animaux",
    color: "#A855F7",
  },
  {
    id: 4,
    name: "Données professionnelles",
    desc: "Poste, revenus, statut, secteur",
    examples: "Poste actuel, revenu annuel, statut (CDI/indépendant), secteur d'activité",
    color: "#F59E0B",
  },
  {
    id: 5,
    name: "Patrimoine & projets",
    desc: "Immobilier, épargne, projets de vie",
    examples: "Propriétaire/locataire, épargne, projet d'achat, succession, création d'entreprise",
    color: "#EF4444",
  },
];

export default function MinimisationPage() {
  const [selectedId, setSelectedId] = useState<string>("contact");
  const selected = OBJECTIVES.find((o) => o.id === selectedId) ?? OBJECTIVES[0];

  return (
    <div className="page" style={{ background: "var(--ivory)", paddingBottom: 96 }}>
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "clamp(40px, 7vw, 64px) 24px 24px",
        }}
      >
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

        <div className="mono caps" style={{ color: "var(--ink-4)", marginBottom: 14 }}>
          Principe de minimisation
        </div>
        <PageVersion version="1.0" />

        <h1
          className="serif"
          style={{
            fontSize: "clamp(32px, 5.5vw, 56px)",
            lineHeight: 1.05,
            marginBottom: 18,
            letterSpacing: "-0.02em",
          }}
        >
          Matrice de minimisation
        </h1>

        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--ink-3)",
            maxWidth: 720,
            marginBottom: 16,
          }}
        >
          Sur BUUPP, un professionnel ne peut <strong>jamais</strong> collecter
          plus de données qu'il n'en a strictement besoin pour la finalité
          déclarée. Cette page détaille les paliers de données autorisés par
          objectif de campagne — c'est la même règle qui s'applique
          automatiquement à chaque création de campagne.
        </p>

        {/* Bloc CNIL */}
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderLeft: "3px solid var(--accent)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 32,
            maxWidth: 720,
          }}
        >
          <div
            className="mono caps"
            style={{
              fontSize: 10,
              letterSpacing: ".12em",
              color: "var(--accent)",
              marginBottom: 6,
              fontWeight: 700,
            }}
          >
            Recommandation CNIL · RGPD article 5.1.c
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
            « Le principe de minimisation prévoit que les données à caractère
            personnel doivent être <strong>adéquates</strong>,{" "}
            <strong>pertinentes</strong> et <strong>limitées à ce qui est
            nécessaire</strong> au regard des finalités pour lesquelles elles
            sont traitées. »
          </p>
          <a
            href="https://www.cnil.fr/fr/definition/minimisation"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: 8,
              fontSize: 12,
              color: "var(--accent)",
              textDecoration: "underline",
            }}
          >
            Source officielle CNIL ↗
          </a>
        </div>
      </div>

      {/* Matrice */}
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        <h2
          className="serif"
          style={{
            fontSize: 24,
            marginBottom: 10,
            letterSpacing: "-0.01em",
          }}
        >
          Comment ça marche
        </h2>
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.55,
            color: "var(--ink-3)",
            marginBottom: 24,
            maxWidth: 720,
          }}
        >
          Sélectionnez un <strong>objectif de campagne</strong> ci-dessous. La
          partie droite vous montre les <strong>sous-types d'opérations</strong>{" "}
          autorisés et les <strong>paliers de données</strong> que BUUPP
          permet de collecter — pas plus.
        </p>

        <div className="mini-matrix">
          {/* Colonne objectifs */}
          <ul className="mini-objectives" role="tablist" aria-label="Objectifs de campagne">
            {OBJECTIVES.map((o) => {
              const active = o.id === selectedId;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedId(o.id)}
                    className="mini-obj-btn"
                    data-active={active ? "true" : "false"}
                  >
                    <span className="mini-obj-icon" aria-hidden>
                      {o.icon}
                    </span>
                    <span className="mini-obj-text">
                      <span className="mini-obj-name">{o.name}</span>
                      <span className="mini-obj-short">{o.short}</span>
                    </span>
                    <span className="mini-obj-count" aria-hidden>
                      {o.sub.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Colonne détail */}
          <div className="mini-detail">
            <div className="mini-card">
              <div className="mini-card-head">
                <div>
                  <div
                    className="mono caps"
                    style={{ fontSize: 10, color: "var(--ink-4)", letterSpacing: ".12em" }}
                  >
                    Objectif sélectionné
                  </div>
                  <h3
                    className="serif"
                    style={{
                      fontSize: 22,
                      margin: "4px 0 0",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {selected.icon} {selected.name}
                  </h3>
                </div>
                <div className="mini-tier-badges">
                  {selected.allowedTiers.map((tid) => {
                    const t = TIERS.find((x) => x.id === tid);
                    if (!t) return null;
                    return (
                      <span
                        key={tid}
                        className="mini-tier-badge"
                        style={{
                          background: `${t.color}12`,
                          border: `1px solid ${t.color}55`,
                          color: t.color,
                        }}
                        title={t.name}
                      >
                        P{tid}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Sous-types */}
              <section style={{ marginTop: 18 }}>
                <div
                  className="mono caps"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-3)",
                    letterSpacing: ".12em",
                    marginBottom: 10,
                    fontWeight: 600,
                  }}
                >
                  Opérations autorisées ({selected.sub.length})
                </div>
                <ul className="mini-sub-list">
                  {selected.sub.map((s) => (
                    <li key={s.id} className="mini-sub-item">
                      <div className="mini-sub-name">{s.name}</div>
                      <div className="mini-sub-desc">{s.desc}</div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Paliers autorisés */}
              <section style={{ marginTop: 24 }}>
                <div
                  className="mono caps"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-3)",
                    letterSpacing: ".12em",
                    marginBottom: 10,
                    fontWeight: 600,
                  }}
                >
                  Paliers de données autorisés ({selected.allowedTiers.length} / 5)
                </div>
                <div className="mini-tier-grid">
                  {TIERS.map((t) => {
                    const allowed = selected.allowedTiers.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        className="mini-tier-card"
                        data-allowed={allowed ? "true" : "false"}
                        style={
                          allowed
                            ? {
                                background: `linear-gradient(135deg, ${t.color}10, ${t.color}03)`,
                                borderColor: `${t.color}55`,
                              }
                            : undefined
                        }
                      >
                        <div className="mini-tier-row">
                          <div
                            className="mini-tier-id"
                            style={{
                              background: allowed ? `${t.color}18` : "var(--ivory-2)",
                              color: allowed ? t.color : "var(--ink-5)",
                              borderColor: allowed ? `${t.color}55` : "var(--line-2)",
                            }}
                          >
                            P{t.id}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="mini-tier-name">{t.name}</div>
                            <div className="mini-tier-desc">{t.desc}</div>
                          </div>
                          <div
                            className="mini-tier-status"
                            data-allowed={allowed ? "true" : "false"}
                          >
                            {allowed ? "✓ Autorisé" : "✕ Bloqué"}
                          </div>
                        </div>
                        {allowed && (
                          <div className="mini-tier-examples">{t.examples}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Note explicative */}
              <div
                style={{
                  marginTop: 22,
                  padding: "12px 14px",
                  background: "var(--ivory-2)",
                  border: "1px solid var(--line-2)",
                  borderRadius: 10,
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: "var(--ink-3)",
                }}
              >
                <strong style={{ color: "var(--ink-2)" }}>Pourquoi cette restriction ?</strong>{" "}
                Pour respecter le principe de minimisation, BUUPP n'autorise un
                pro qu'à demander les paliers <strong>strictement nécessaires</strong>{" "}
                à l'objectif déclaré. Un pro qui veut envoyer un email
                promotionnel n'a pas besoin de connaître votre patrimoine — le
                wizard de campagne bloque cette combinaison côté serveur.
              </div>
            </div>
          </div>
        </div>

        {/* Tableau récap synthétique */}
        <section style={{ marginTop: 56 }}>
          <h2
            className="serif"
            style={{
              fontSize: 24,
              marginBottom: 10,
              letterSpacing: "-0.01em",
            }}
          >
            Vue d'ensemble
          </h2>
          <p
            style={{
              fontSize: 14.5,
              lineHeight: 1.55,
              color: "var(--ink-3)",
              marginBottom: 16,
              maxWidth: 720,
            }}
          >
            Tableau récapitulatif de toutes les correspondances objectifs ×
            paliers. Une coche signifie que BUUPP autorise la collecte de ce
            palier pour cet objectif.
          </p>

          <div className="mini-recap-scroll">
            <table className="mini-recap">
              <thead>
                <tr>
                  <th
                    scope="col"
                    style={{ textAlign: "left", padding: "10px 12px", minWidth: 200 }}
                  >
                    Objectif
                  </th>
                  {TIERS.map((t) => (
                    <th
                      key={t.id}
                      scope="col"
                      style={{ padding: "10px 8px", minWidth: 90 }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: t.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        P{t.id} · {t.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {OBJECTIVES.map((o) => (
                  <tr key={o.id}>
                    <th
                      scope="row"
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      <span style={{ marginRight: 8 }}>{o.icon}</span>
                      {o.name}
                    </th>
                    {TIERS.map((t) => {
                      const ok = o.allowedTiers.includes(t.id);
                      return (
                        <td
                          key={t.id}
                          style={{
                            textAlign: "center",
                            padding: "10px 8px",
                            color: ok ? t.color : "var(--ink-5)",
                            fontWeight: ok ? 700 : 400,
                            fontSize: ok ? 16 : 14,
                          }}
                        >
                          {ok ? "✓" : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div
          style={{
            marginTop: 40,
            paddingTop: 28,
            borderTop: "1px solid var(--line)",
          }}
        >
          <BackHomeButton />
        </div>
      </div>

      <style>{`
        .mini-matrix {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 40px;
        }
        @media (min-width: 880px) {
          .mini-matrix { grid-template-columns: 280px 1fr; gap: 20px; }
        }

        .mini-objectives {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .mini-obj-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 14px;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          transition: border-color .15s, background .15s, box-shadow .15s;
          font-family: inherit;
          color: var(--ink);
        }
        .mini-obj-btn:hover {
          border-color: var(--ink-5);
          background: color-mix(in oklab, var(--accent) 3%, var(--paper));
        }
        .mini-obj-btn[data-active="true"] {
          border-color: var(--accent);
          background: color-mix(in oklab, var(--accent) 8%, var(--paper));
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 15%, transparent);
        }

        .mini-obj-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--ivory-2);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
          color: var(--ink-2);
        }
        .mini-obj-btn[data-active="true"] .mini-obj-icon {
          background: color-mix(in oklab, var(--accent) 16%, var(--paper));
          color: var(--accent);
        }

        .mini-obj-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .mini-obj-name {
          font-size: 13.5px;
          font-weight: 600;
          line-height: 1.25;
        }
        .mini-obj-short {
          font-size: 11.5px;
          color: var(--ink-4);
          line-height: 1.3;
        }
        .mini-obj-count {
          font-family: var(--mono);
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 999px;
          background: var(--ivory-2);
          color: var(--ink-4);
          flex-shrink: 0;
        }
        .mini-obj-btn[data-active="true"] .mini-obj-count {
          background: color-mix(in oklab, var(--accent) 18%, var(--paper));
          color: var(--accent);
        }

        .mini-card {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 22px;
        }
        .mini-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .mini-tier-badges {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .mini-tier-badge {
          font-family: var(--mono);
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          letter-spacing: 0.02em;
        }

        .mini-sub-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        @media (min-width: 640px) {
          .mini-sub-list { grid-template-columns: repeat(2, 1fr); }
        }
        .mini-sub-item {
          padding: 10px 12px;
          background: var(--ivory-2);
          border: 1px solid var(--line-2);
          border-radius: 8px;
        }
        .mini-sub-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 3px;
        }
        .mini-sub-desc {
          font-size: 11.5px;
          line-height: 1.45;
          color: var(--ink-4);
        }

        .mini-tier-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mini-tier-card {
          padding: 12px 14px;
          background: var(--paper);
          border: 1px solid var(--line-2);
          border-radius: 10px;
          transition: all .15s;
        }
        .mini-tier-card[data-allowed="false"] {
          opacity: 0.55;
        }
        .mini-tier-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .mini-tier-id {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          border: 1px solid;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: var(--mono);
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .mini-tier-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }
        .mini-tier-desc {
          font-size: 11.5px;
          color: var(--ink-4);
          line-height: 1.3;
        }
        .mini-tier-status {
          font-family: var(--mono);
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 999px;
          letter-spacing: 0.04em;
          font-weight: 600;
          white-space: nowrap;
        }
        .mini-tier-status[data-allowed="true"] {
          background: rgba(34, 197, 94, 0.1);
          color: #15803d;
          border: 1px solid rgba(34, 197, 94, 0.4);
        }
        .mini-tier-status[data-allowed="false"] {
          background: var(--ivory-2);
          color: var(--ink-5);
          border: 1px solid var(--line-2);
        }
        .mini-tier-examples {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed var(--line-2);
          font-size: 11.5px;
          line-height: 1.45;
          color: var(--ink-3);
          font-style: italic;
        }

        .mini-recap-scroll {
          overflow-x: auto;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--paper);
        }
        .mini-recap {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .mini-recap thead {
          background: var(--ivory-2);
          border-bottom: 1px solid var(--line);
        }
        .mini-recap tbody tr {
          border-top: 1px solid var(--line-2);
        }
        .mini-recap tbody tr:hover {
          background: color-mix(in oklab, var(--accent) 3%, var(--paper));
        }
      `}</style>
    </div>
  );
}
