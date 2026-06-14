"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Bouton « En savoir plus » + modal expliquant la pseudonymisation des données.
 *
 * Design d'après public/prototype/des.html : carte ivoire, légende des types de
 * transformation, et pour chaque donnée (par palier) une ligne
 *   « ce que vous renseignez » → transformation → « ce que reçoit le pro ».
 * Responsive : 3 colonnes en desktop, empilé vertical en mobile.
 *
 * ⚠️ Les valeurs (colonnes transformation / sortie) sont des EXEMPLES
 * PROVISOIRES. Les règles définitives par donnée seront fournies ensuite :
 * mettre à jour `kind` / `out` dans TIERS.
 */

type KindKey = "supp" | "mask" | "gen" | "cat" | "keep";

const KIND: Record<KindKey, { nm: string; fg: string; bg: string; bd: string; dot: string; icon: ReactNode }> = {
  supp: {
    nm: "Suppression", fg: "#c0432d", bg: "#fdeae6", bd: "#f6cfc6", dot: "#e7644b",
    icon: <path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M7 7l1 12h8l1-12" />,
  },
  mask: {
    nm: "Masquage", fg: "#5b3fe0", bg: "#efeaff", bd: "#d9cfff", dot: "#7c5cff",
    icon: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M3 3l18 18" /></>,
  },
  gen: {
    nm: "Généralisation", fg: "#1f63d6", bg: "#e7f0ff", bd: "#caddf8", dot: "#3b82f6",
    icon: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>,
  },
  cat: {
    nm: "Catégorisation", fg: "#0d8a64", bg: "#e4f6ef", bd: "#bfe6d4", dot: "#10b981",
    icon: <><path d="M3 12.5V5a2 2 0 0 1 2-2h7.5L21 11.5a2 2 0 0 1 0 2.8l-6.7 6.7a2 2 0 0 1-2.8 0z" /><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" /></>,
  },
  keep: {
    nm: "Conservé", fg: "#475569", bg: "#eef1f6", bd: "#d6dde7", dot: "#64748b",
    icon: <path d="M5 12l4.5 4.5L19 7" />,
  },
};

type Field = { label: string; value: string; kind: KindKey; out: string };
type Tier = { n: number; name: string; reward: string; fields: Field[] };

const TIERS: Tier[] = [
  {
    n: 1, name: "Identification", reward: "minimum 1,00 €",
    fields: [
      { label: "Prénom", value: "Marie", kind: "keep", out: "Marie" },
      { label: "Nom", value: "Dubois", kind: "mask", out: "D•••••" },
      { label: "Email", value: "marie@email.fr", kind: "mask", out: "ma••@••••" },
      { label: "Téléphone", value: "06 12 34 56 78", kind: "keep", out: "06 12 34 56 78" },
      { label: "Date de naissance", value: "12/04/1990", kind: "gen", out: "30–39 ans" },
    ],
  },
  {
    n: 2, name: "Localisation", reward: "1,00 € – 2,00 €",
    fields: [
      { label: "Adresse postale", value: "12 rue de la République", kind: "gen", out: "< 2 km du centre" },
      { label: "Ville", value: "Lyon", kind: "keep", out: "Lyon" },
      { label: "Code postal", value: "69002", kind: "gen", out: "69 · Rhône" },
      { label: "Région", value: "Auvergne-Rhône-Alpes", kind: "keep", out: "Auvergne-Rhône-Alpes" },
    ],
  },
  {
    n: 3, name: "Style de vie", reward: "2,00 € – 3,50 €",
    fields: [
      { label: "Composition du foyer", value: "Mariée · 2 enfants", kind: "cat", out: "Foyer avec enfants" },
      { label: "Type de logement", value: "Propriétaire", kind: "keep", out: "Propriétaire" },
      { label: "Mobilité", value: "Voiture + transports", kind: "keep", out: "Voiture + transports" },
      { label: "Véhicule", value: "Peugeot 308 · 2019", kind: "cat", out: "Citadine" },
      { label: "Sports / loisirs", value: "Course à pied, ski", kind: "keep", out: "Course à pied, ski" },
      { label: "Animaux", value: "Chien", kind: "cat", out: "Animal de compagnie" },
    ],
  },
  {
    n: 4, name: "Données professionnelles", reward: "3,50 € – 5,00 €",
    fields: [
      { label: "Statut", value: "Cadre", kind: "keep", out: "Cadre" },
      { label: "Secteur", value: "Industrie manufacturière", kind: "keep", out: "Industrie manufacturière" },
    ],
  },
  {
    n: 5, name: "Patrimoine & projets", reward: "5,00 € – 10,00 €",
    fields: [
      { label: "Résidence principale", value: "Propriétaire", kind: "keep", out: "Propriétaire" },
      { label: "Projets à 3–5 ans", value: "Achat immobilier", kind: "cat", out: "Projet immobilier" },
    ],
  },
];

function Conn() {
  return (
    <span className="anon-conn" aria-hidden>
      <svg width="62" height="20" viewBox="0 0 62 20" fill="none">
        <line className="anon-dash" x1="2" y1="10" x2="48" y2="10" stroke="#c9b8ff" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.5 9" />
        <path d="M48 4l9 6-9 6" fill="none" stroke="#8a6bff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function AnonymizationModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn btn-accent" onClick={() => setOpen(true)}>
        En savoir plus sur la pseudonymisation
      </button>

      {open && (
        <div
          className="anon-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="anon-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="anon-card">
            <div className="anon-hd">
              <div className="eb">CONFIDENTIALITÉ PAR CONCEPTION</div>
              <h3 id="anon-title">Comment vos données sont pseudonymisées</h3>
              <div className="sub">
                Palier par palier&nbsp;: ce que vous renseignez, la transformation
                appliquée par buupp, et ce qui parvient réellement au professionnel.
              </div>
              <button type="button" className="anon-close" aria-label="Fermer" onClick={() => setOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="anon-body">
              <div className="anon-disc">
                <span className="i">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 11h1v5h1" />
                  </svg>
                </span>
                <p>
                  Exemples illustratifs — les règles de pseudonymisation définitives
                  propres à chaque donnée seront précisées prochainement.
                </p>
              </div>

              <div className="anon-legend">
                {(Object.keys(KIND) as KindKey[]).map((k) => (
                  <span className="anon-lg" key={k}>
                    <span className="dot" style={{ background: KIND[k].dot }} />
                    {KIND[k].nm}
                  </span>
                ))}
              </div>

              <div className="anon-cols">
                <div className="ch l">CE QUE VOUS RENSEIGNEZ</div>
                <div className="ch" />
                <div className="ch">PSEUDONYMISÉ PAR buupp</div>
                <div className="ch" />
                <div className="ch r">CE QUE REÇOIT LE PRO</div>
              </div>

              {TIERS.map((tier) => (
                <div key={tier.n}>
                  <div className="anon-palier">
                    <div className="lft">
                      <span className="anon-pbadge">PALIER {tier.n}</span>
                      <h4>{tier.name}</h4>
                    </div>
                    <span className="anon-price"><span className="c">●</span>{tier.reward}</span>
                  </div>

                  {tier.fields.map((f) => {
                    const k = KIND[f.kind];
                    const empty = f.out === "—";
                    return (
                      <div className="anon-row" key={f.label}>
                        <div className="anon-in">
                          <div className="lab">{f.label}</div>
                          <div className="val">{f.value}</div>
                        </div>
                        <Conn />
                        <div className="anon-tf" style={{ background: k.bg, borderColor: k.bd, color: k.fg }}>
                          <span className="anon-mtag" style={{ color: k.fg, opacity: 0.7 }}>Pseudonymisé</span>
                          <span className="ic">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={k.fg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              {k.icon}
                            </svg>
                          </span>
                          <span className="nm">{k.nm}</span>
                        </div>
                        <Conn />
                        <div className={empty ? "anon-out empty" : "anon-out"}>
                          <span className="anon-mtag" style={{ color: "#8a93a8" }}>Le pro reçoit</span>
                          <span className="m">{f.out}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="anon-foot">
                <span className="i">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l4.5 4.5L19 7" />
                  </svg>
                </span>
                <p>
                  <b>Aucune donnée directement identifiante n&apos;est transmise.</b> Le
                  professionnel ne reçoit qu&apos;un profil pseudonymisé — réversible
                  uniquement par buupp, et journalisé conformément au RGPD.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
