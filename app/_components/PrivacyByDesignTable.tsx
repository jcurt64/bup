import { type ReactNode } from "react";

/**
 * Tableau « Confidentialité par conception » : ce que le prospect renseigne,
 * la transformation appliquée par buupp, et ce qui parvient réellement au
 * professionnel.
 *
 * Depuis le 22/11/2026, BUUPP ne collecte plus que sept données (prénom,
 * initiale du nom, ville, sexe, tranche d'âge, téléphone, e-mail) : le pro ne
 * voit que le prénom et l'initiale ; ville, sexe et tranche d'âge servent
 * uniquement au ciblage des campagnes ; téléphone et e-mail ne lui sont jamais
 * transmis, les appels et e-mails étant relayés par la plateforme.
 *
 * Extrait de AnonymizationModal pour pouvoir être affiché EN LIGNE (page
 * « À propos ») autant que dans la modale.
 */

type KindKey = "keep" | "mask" | "target" | "relay";

const KIND: Record<KindKey, { nm: string; fg: string; bg: string; bd: string; dot: string; icon: ReactNode }> = {
  keep: {
    nm: "Conservé", fg: "#475569", bg: "#eef1f6", bd: "#d6dde7", dot: "#64748b",
    icon: <path d="M5 12l4.5 4.5L19 7" />,
  },
  mask: {
    nm: "Réduit à l’initiale", fg: "#5b3fe0", bg: "#efeaff", bd: "#d9cfff", dot: "#7c5cff",
    icon: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M3 3l18 18" /></>,
  },
  target: {
    nm: "Ciblage uniquement", fg: "#b45309", bg: "#fdf3e1", bd: "#f3dcae", dot: "#d97706",
    icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  },
  relay: {
    nm: "Relayé par buupp", fg: "#0d8a64", bg: "#e4f6ef", bd: "#bfe6d4", dot: "#10b981",
    icon: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  },
};

type Field = { label: string; value: string; kind: KindKey; out: string };

const FIELDS: Field[] = [
  { label: "Prénom", value: "Marie", kind: "keep", out: "Marie" },
  { label: "Nom", value: "Dubois", kind: "mask", out: "D." },
  { label: "Ville", value: "Lyon", kind: "target", out: "Jamais transmise" },
  { label: "Sexe", value: "Femme", kind: "target", out: "Jamais transmis" },
  { label: "Tranche d’âge", value: "18–35 ans", kind: "target", out: "Jamais transmise" },
  { label: "Téléphone", value: "06 12 34 56 78", kind: "relay", out: "Jamais transmis" },
  { label: "E-mail", value: "marie@email.fr", kind: "relay", out: "Jamais transmis" },
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

/**
 * Contenu du tableau (sans le wrapper `.anon-body` ni l'overlay de la modale).
 * Le composant appelant choisit son cadre :
 *   — la modale l'enveloppe dans `.anon-body` (scrollable) ;
 *   — la page « À propos » l'enveloppe dans une carte ivoire en pleine largeur.
 *
 * `disclaimer` (défaut true) affiche l'encart « exemples illustratifs ».
 */
export default function PrivacyByDesignTable({
  disclaimer = true,
}: {
  disclaimer?: boolean;
}) {
  return (
    <>
      {disclaimer && (
        <div className="anon-disc">
          <span className="i">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 11h1v5h1" />
            </svg>
          </span>
          <p>
            Exemple illustratif — buupp ne vous demande que ces sept
            données&nbsp;: aucune date de naissance, aucune adresse, aucune
            autre information personnelle. Ville, sexe et tranche d&apos;âge
            servent uniquement à vous proposer des offres pertinentes.
          </p>
        </div>
      )}

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

      <div className="anon-tier">
        <div className="anon-palier">
          <div className="lft">
            <span className="anon-pbadge">DONNÉES DU PROFIL</span>
            <h4>Les seules données demandées</h4>
          </div>
          <span className="anon-price"><span className="c">●</span>1,00&nbsp;€ × durée</span>
        </div>

        {FIELDS.map((f) => {
          const k = KIND[f.kind];
          return (
            <div className="anon-row" key={f.label}>
              <div className="anon-in">
                <div className="lab">{f.label}</div>
                <div className="val">{f.value}</div>
              </div>
              <Conn />
              <div className="anon-tf" style={{ background: k.bg, borderColor: k.bd, color: k.fg }}>
                <span className="anon-mtag" style={{ color: k.fg, opacity: 0.7 }}>Protégé</span>
                <span className="ic">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={k.fg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {k.icon}
                  </svg>
                </span>
                <span className="nm">{k.nm}</span>
              </div>
              <Conn />
              <div className="anon-out">
                <span className="anon-mtag" style={{ color: "#8a93a8" }}>Le pro reçoit</span>
                <span className="m">{f.out}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="anon-foot">
        <span className="i">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l4.5 4.5L19 7" />
          </svg>
        </span>
        <p>
          <b>Le pro ne voit que votre prénom et l&apos;initiale de votre nom</b>{" "}
          — juste de quoi échanger convenablement, sans démarrer par un
          «&nbsp;euh… bonjour, c&apos;est bien vous&nbsp;?&nbsp;». Votre numéro,
          votre adresse e-mail, votre ville, votre sexe et votre tranche
          d&apos;âge ne lui sont jamais transmis&nbsp;: tout contact passe par la
          plateforme buupp.
        </p>
      </div>
    </>
  );
}
