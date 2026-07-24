"use client";

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  Fragment,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useRoleGuard, useCurrentRole } from "./RoleGuard";
import DemoModal from "./DemoModal";
import { Icon, Navbar, Footer, type IconName } from "./SiteChrome";
import VideoLearnSection from "./VideoLearnSection";

type Router = ReturnType<typeof useRouter>;

function goWaitlist(router: Router) {
  try {
    sessionStorage.setItem("bupp:waitlist-ok", "1");
  } catch {}
  router.push("/liste-attente");
}

const TIERS = [
  {
    n: 1,
    name: "Identification",
    ex: "email, nom, téléphone",
    range: "minimum 1,00 €",
    low: 1.0,
    high: 1.0,
  },
  {
    n: 2,
    name: "Localisation",
    ex: "adresse, logement",
    range: "1,00 € – 2,00 €",
    low: 1.0,
    high: 2.0,
  },
  {
    n: 3,
    name: "Style de vie",
    ex: "habitudes, famille, véhicule",
    range: "2,00 € – 3,50 €",
    low: 2.0,
    high: 3.5,
  },
  {
    n: 4,
    name: "Données professionnelles",
    ex: "statut, secteur",
    range: "3,50 € – 5,00 €",
    low: 3.5,
    high: 5.0,
  },
  {
    n: 5,
    name: "Patrimoine & projets",
    ex: "immobilier, projets",
    range: "5,00 € – 10,00 €",
    low: 5.0,
    high: 10.0,
  },
];

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

const ROTATING_WORDS = [
  { t: "gagnant-gagnant.", color: "#A5B4FC" },
  { t: "win-win.", color: "#FB923C" },
  { t: "équitable.", color: "#16a34a" },
];

function RotatingHeadlineWord() {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");
  useEffect(() => {
    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const tick = () => {
      if (!mounted) return;
      setPhase("in");
      const showT = setTimeout(() => {
        if (!mounted) return;
        setPhase("out");
        const swapT = setTimeout(() => {
          if (!mounted) return;
          setI((n) => (n + 1) % ROTATING_WORDS.length);
          setPhase("in");
          const nextT = setTimeout(tick, 1000);
          timers.push(nextT);
        }, 420);
        timers.push(swapT);
      }, 1000);
      timers.push(showT);
    };
    tick();
    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
    };
  }, []);
  const current = ROTATING_WORDS[i];
  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        minWidth: "8ch",
        verticalAlign: "baseline",
      }}
    >
      <span
        key={`${i}-${phase}`}
        style={{
          display: "inline-block",
          fontStyle: "italic",
          color: current.color,
          transition:
            "transform .42s cubic-bezier(.22,.8,.24,1), opacity .42s cubic-bezier(.22,.8,.24,1), filter .42s",
          transform:
            phase === "in"
              ? "translateY(0) rotateX(0deg)"
              : "translateY(-0.25em) rotateX(45deg)",
          opacity: phase === "in" ? 1 : 0,
          filter: phase === "in" ? "blur(0)" : "blur(3px)",
          transformOrigin: "bottom center",
          willChange: "transform, opacity",
        }}
      >
        {current.t}
      </span>
    </span>
  );
}

// Mois + année courants en français (ex. « mai 2026 »). Calcul
// déterministe le même jour côté SSR et côté client → pas de
// hydration mismatch ; l'effet ne resynchronise que le cas limite
// d'un changement de mois pile entre le rendu serveur et le montage.
function currentPeriodFr(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function Hero() {
  const router = useRouter();
  const { guard, modal: roleModal } = useRoleGuard();
  const [heroPeriod, setHeroPeriod] = useState(currentPeriodFr);
  useEffect(() => {
    // Resync one-shot au montage pour couvrir le cas limite d'un
    // changement de mois pile entre rendu serveur et hydratation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeroPeriod(currentPeriodFr());
  }, []);
  return (
    <section
      className="hero-section"
      data-nav-theme="dark"
      style={{
        background: "#0F1629",
        color: "var(--paper)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px)",
          backgroundSize: "88px 88px",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-280px",
          left: "-220px",
          width: "min(900px, 120%)",
          height: "900px",
          background:
            "radial-gradient(closest-side, rgba(249,115,22,.22) 0%, rgba(249,115,22,.08) 35%, rgba(249,115,22,0) 70%)",
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "60%",
          height: "100%",
          background:
            "radial-gradient(ellipse at 90% 30%, rgba(165,180,252,.08) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />
      <div className="container" style={{ position: "relative" }}>
        <div
          className="row between wrap"
          style={{ alignItems: "baseline", marginBottom: 40, gap: 16 }}
        >
          <div className="row center gap-3">
            <span
              className="badge"
              style={{
                background: "transparent",
                color: "var(--ivory)",
                letterSpacing: "0.10em",
                borderColor: "rgba(255,255,255,.18)",
              }}
            >
              <span
                className="dot pulse-dot"
                style={{ background: "#16a34a" }}
              />
              Vos données ont de la valeur — récupérez-la
            </span>
          </div>
          <div
            className="mono hide-sm"
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,.5)",
              textTransform: "uppercase",
            }}
          >
            Be Used · <p className="inline text-[#4596EC]">Paid &amp; Proud</p>{" "}
            — France, {heroPeriod}
          </div>
        </div>

        <h1 className="serif" style={{ color: "var(--paper)", maxWidth: 1100 }}>
          Le marketing
          <br />
          <RotatingHeadlineWord />
        </h1>

        <div
          className="hero-cta-row"
          style={{
            marginTop: 40,
            gap: 32,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <h2
            className="hero-lede"
            style={{
              flex: "1 1 320px",
              maxWidth: 520,
              fontSize: "clamp(15px, 1.6vw, 19px)",
              lineHeight: 1.75,
              letterSpacing: "0.04em",
              color: "rgba(255,255,255,.78)",
            }}
          >
            BUUPP renverse la table 🎯. Première plateforme où ce sont les
            professionnels qui rémunèrent les particuliers pour avoir le droit
            de les solliciter.
            <p>
              Votre temps, c&apos;est de l&apos;argent — et on vous le prouve.
              {/* BUUPP est la première plateforme qui rémunère les particuliers pour
            accepter d&apos;être contactés par les professionnels. Double
            consentement,{" "} */}
            </p>
            <p className="inline font-extrabold italic tracking-wider underline underline-offset-4 text-[#FB923C]">
              {"<"}RGPD natif {">"}.
            </p>
          </h2>
          <div
            className="hero-buttons"
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <button
              className="btn btn-lg btn-block-mobile hero-cta hero-cta-pre"
              onClick={() => goWaitlist(router)}
              style={{
                background: "linear-gradient(135deg, #4596EC 0%, #6BA8F0 100%)",
                color: "#0F1629",
                fontWeight: 600,
                boxShadow:
                  "0 12px 28px -8px rgba(69,150,236,.55), inset 0 1px 0 rgba(255,255,255,.4)",
              }}
            >
              <Icon name="sparkle" size={16} /> Pré-inscription
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: "rgba(15,22,41,.18)",
                  marginLeft: 6,
                }}
              >
                +5€
              </span>
            </button>
            <button
              className="btn btn-lg btn-block-mobile hero-cta hero-cta-prospect"
              onClick={() =>
                guard(
                  "prospect",
                  "/prospect",
                  "/connexion?intent=prospect&mode=signin",
                )
              }
              style={{ background: "var(--paper)", color: "var(--ink)" }}
            >
              Je suis prospect <Icon name="arrow" size={16} />
            </button>
            <button
              className="btn btn-lg btn-ghost btn-block-mobile hero-cta hero-cta-pro"
              onClick={() =>
                guard("pro", "/pro", "/connexion?intent=pro&mode=signin")
              }
              style={{
                color: "var(--paper)",
                borderColor: "rgba(255,255,255,.28)",
              }}
            >
              Je suis professionnel
            </button>
          </div>
        </div>

        <div
          className="hero-live"
          style={{
            marginTop: 56,
            borderTop: "1px solid rgba(255,255,255,.1)",
            paddingTop: 24,
            overflow: "hidden",
          }}
        >
          <LiveRelationsTicker />
        </div>
      </div>
      {roleModal}
    </section>
  );
}

/* Bandeau live de la home page — défile de droite à gauche les
   dernières mises en relation acceptées (status accepted ou settled),
   anonymisées côté API : secteur + ville pour le pro, prénom + initiale
   du nom pour le prospect.

   - en attente / API KO / liste vide → bandeau masqué (aucun mock visible)
   - sinon → vraies données qui défilent */
type TickerRow = {
  id: string;
  sector: string;
  city: string;
  prenomMasked: string;
  rewardEur: number;
};

function LiveRelationsTicker() {
  const [rows, setRows] = useState<TickerRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/landing/recent-relations", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (cancelled) return;
          const list: TickerRow[] = Array.isArray(j?.relations)
            ? j.relations
            : [];
          setRows(list);
        })
        .catch(() => {
          if (!cancelled) setRows([]);
        });
    };
    load();
    // Rafraîchit toutes les 5 minutes — assez fréquent pour rester
    // "live", assez rare pour ne pas spammer l'API.
    const t = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!rows || rows.length === 0) return null;

  const fmtEur = (eur: number) =>
    Number(eur || 0)
      .toFixed(2)
      .replace(".", ",");

  return (
    <>
      <div
        className="mono hero-live-label"
        style={{
          fontSize: 10,
          letterSpacing: ".18em",
          color: "rgba(22,163,74)",
          marginBottom: 14,
        }}
      >
        ● EN DIRECT — Demandes acceptées ces dernières heures
      </div>
      <div style={{ overflow: "hidden" }}>
        <div className="marquee">
          {[...Array(2)].flatMap((_, r) =>
            rows.map((it, i) => {
              const where = [it.sector, it.city]
                .filter(Boolean)
                .join(" à ")
                .trim();
              return (
                <div
                  key={`${r}-${it.id || i}`}
                  className="row center gap-3"
                  style={{ fontSize: 13, color: "rgba(255,255,255,.7)" }}
                >
                  <span style={{ color: "rgba(255,255,255,.4)" }}>◇</span>
                  <span>{where || it.sector || it.city || "—"}</span>
                  <span style={{ color: "rgba(255,255,255,.4)" }}>→</span>
                  <span>{it.prenomMasked}</span>
                  <span className="mono" style={{ color: "#A5B4FC" }}>
                    +{fmtEur(it.rewardEur)} €
                  </span>
                </div>
              );
            }),
          )}
        </div>
      </div>
    </>
  );
}

type Deal = {
  id: string;
  name: string;
  endsAt: string;
  brief: string | null;
  multiplier: number;
  costPerContactCents: number;
  founderBonusApplied: boolean;
  founderVipBonusApplied: boolean;
  requiredTiers: number[];
  requiredTierKeys: string[];
  proName: string | null;
  proSector: string | null;
  isAuthenticated: boolean;
  relationId: string | null;
  relationStatus: string | null;
  missingTierKeys: string[] | null;
};

const TIER_KEY_LABEL_FR: Record<string, string> = {
  identity: "Identification",
  localisation: "Localisation",
  vie: "Style de vie",
  pro: "Données professionnelles",
  patrimoine: "Patrimoine & projets",
};

// Clé de palier → numéro (1-5), pour deep-linker « Mes données » sur le bon
// palier depuis le CTA « Compléter mes données ».
const TIER_NUM_BY_KEY: Record<string, number> = {
  identity: 1,
  localisation: 2,
  vie: 3,
  pro: 4,
  patrimoine: 5,
};

function fmtMultiplier(m: number): string {
  if (m === 1) return "×1";
  if (Number.isInteger(m)) return `×${m}`;
  return `×${String(m).replace(".", ",")}`;
}

// ─── Persistance des décisions sur les flash deals fictifs ────────
// Les mocks ne créent pas de relation en base. Pour que (a) la modale
// affiche "déjà acceptée" / "déjà refusée" si l'utilisateur reclique
// dessus, et (b) le prototype prospect puisse afficher ces décisions
// dans l'onglet "Mises en relation", on les persiste dans
// localStorage. Même clé lue par /public/prototype/components/Prospect.jsx.
const MOCK_DECISIONS_KEY = "bupp:mock-deal-decisions:v1";
const MOCK_DECISIONS_EVENT = "bupp:mock-deal-decisions-changed";

// ─── Rate-limit client (anti-spam local pour mocks ET vrais decisions) ──
// Aligné sur le rate-limit serveur (/api/prospect/relations/[id]/decision) :
// 1 décision toutes les 5 min PAR SOLLICITATION. Les mocks bypassent le
// serveur — sans ce guard local, l'utilisateur peut spammer Accept/Refuse
// en boucle. Le guard sert aussi de pré-check UX pour les vraies
// décisions (évite un aller-retour réseau et affiche un countdown).
//
// Stockage : map { <dealId | relationId>: timestamp } dans localStorage
// (clé v2 pour invalider l'ancien store global v1).
const DECISION_RATE_KEY = "bupp:last-decision-by-deal:v2";
const DECISION_COOLDOWN_MS = 5 * 60 * 1000;

function getDecisionTimestamps(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DECISION_RATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}
function setLastDecisionAtFor(dealId: string, ts: number): void {
  if (typeof window === "undefined" || !dealId) return;
  try {
    const store = getDecisionTimestamps();
    store[dealId] = ts;
    // GC léger : supprime les entrées dont le cooldown est largement
    // expiré (> 30 min) pour éviter que le store gonfle indéfiniment.
    const cutoff = ts - 30 * 60 * 1000;
    for (const k of Object.keys(store)) {
      if (store[k] < cutoff) delete store[k];
    }
    window.localStorage.setItem(DECISION_RATE_KEY, JSON.stringify(store));
  } catch {}
}
function decisionCooldownLeftMs(
  dealId: string,
  now: number = Date.now(),
): number {
  if (!dealId) return 0;
  const last = getDecisionTimestamps()[dealId];
  if (typeof last !== "number") return 0;
  return Math.max(0, last + DECISION_COOLDOWN_MS - now);
}
function formatCooldownMs(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} s`;
  if (r === 0) return `${m} min`;
  return `${m} min ${r} s`;
}
function buildCooldownMessage(remainingMs: number): string {
  return `Pas trop vite 😊 vous pouvez accepter ou refuser cette sollicitation qu'une fois toutes les 5 minutes. Réessayez dans ${formatCooldownMs(remainingMs)}.`;
}

type MockDecisionRecord = {
  decision: "accepted" | "refused";
  decidedAt: string;
  // Snapshot suffisant pour reconstruire un item d'historique côté
  // prototype, sans dépendance directe au composant home.
  dealId: string;
  proName: string;
  proSector: string;
  name: string;
  brief: string | null;
  multiplier: number;
  rewardCents: number;
  requiredTiers: number[];
  requiredTierKeys: string[];
  endsAt: string;
};
type MockDecisionStore = Record<string, MockDecisionRecord>;

function readMockDecisions(): MockDecisionStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MOCK_DECISIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as MockDecisionStore)
      : {};
  } catch {
    return {};
  }
}

function writeMockDecision(
  deal: Deal,
  decision: "accepted" | "refused" | null,
) {
  if (typeof window === "undefined") return;
  try {
    const store = readMockDecisions();
    if (decision === null) {
      delete store[deal.id];
    } else {
      store[deal.id] = {
        decision,
        decidedAt: new Date().toISOString(),
        dealId: deal.id,
        proName: deal.proName ?? "",
        proSector: deal.proSector ?? "",
        name: deal.name,
        brief: deal.brief,
        multiplier: deal.multiplier,
        rewardCents: deal.costPerContactCents,
        requiredTiers: deal.requiredTiers,
        requiredTierKeys: deal.requiredTierKeys,
        endsAt: deal.endsAt,
      };
    }
    window.localStorage.setItem(MOCK_DECISIONS_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(MOCK_DECISIONS_EVENT));
  } catch {
    /* quota / storage indisponible — silencieux, c'est de la démo */
  }
}

function buildMockDeals(now: number): Deal[] {
  const inMin = (m: number) => new Date(now + m * 60_000).toISOString();
  return [
    {
      id: "mock-plomberie-st-antoine",
      name: "Prospects chauffage & sanitaires",
      endsAt: inMin(47),
      brief:
        "Plombier-chauffagiste cherche propriétaires avec projet de remplacement chaudière dans les 6 mois.",
      multiplier: 3,
      costPerContactCents: 1200,
      founderBonusApplied: false,
      founderVipBonusApplied: false,
      requiredTiers: [1, 2],
      requiredTierKeys: ["identity", "localisation"],
      proName: "Plomberie Saint-Antoine",
      proSector: "Chauffage & sanitaires",
      isAuthenticated: false,
      relationId: null,
      relationStatus: null,
      missingTierKeys: null,
    },
    {
      id: "mock-cap-conseil",
      name: "Acquéreurs primo-accédants",
      endsAt: inMin(53),
      brief:
        "Cabinet de gestion de patrimoine : prospects en projet d'achat immobilier dans les 12 mois.",
      multiplier: 4,
      costPerContactCents: 850,
      founderBonusApplied: false,
      founderVipBonusApplied: false,
      requiredTiers: [1, 2, 5],
      requiredTierKeys: ["identity", "localisation", "patrimoine"],
      proName: "Cap Conseil",
      proSector: "Immobilier & patrimoine",
      isAuthenticated: false,
      relationId: null,
      relationStatus: null,
      missingTierKeys: null,
    },
    {
      id: "mock-volets-bleus",
      name: "Cuisine équipée — devis sur mesure",
      endsAt: inMin(38),
      brief:
        "Cuisiniste artisan : recherche propriétaires en projet de rénovation cuisine, budget 8 000 € et plus.",
      multiplier: 2,
      costPerContactCents: 680,
      founderBonusApplied: false,
      founderVipBonusApplied: false,
      requiredTiers: [1, 2, 3],
      requiredTierKeys: ["identity", "localisation", "vie"],
      proName: "Atelier des Volets Bleus",
      proSector: "Cuisine & aménagement",
      isAuthenticated: false,
      relationId: null,
      relationStatus: null,
      missingTierKeys: null,
    },
    {
      id: "mock-solaria",
      name: "Bilan énergétique solaire offert",
      endsAt: inMin(42),
      brief:
        "Installateur photovoltaïque : prospects propriétaires intéressés par l'auto-consommation solaire.",
      multiplier: 3,
      costPerContactCents: 1020,
      founderBonusApplied: false,
      founderVipBonusApplied: false,
      requiredTiers: [1, 2, 5],
      requiredTierKeys: ["identity", "localisation", "patrimoine"],
      proName: "Solaria",
      proSector: "Énergies renouvelables",
      isAuthenticated: false,
      relationId: null,
      relationStatus: null,
      missingTierKeys: null,
    },
    {
      id: "mock-mutuelle-aquitania",
      name: "Mutuelle santé senior — devis gratuit",
      endsAt: inMin(56),
      brief:
        "Courtier en assurance recherche prospects 55-70 ans souhaitant comparer leur mutuelle santé actuelle.",
      multiplier: 3,
      costPerContactCents: 940,
      founderBonusApplied: false,
      founderVipBonusApplied: false,
      requiredTiers: [1, 2, 4],
      requiredTierKeys: ["identity", "localisation", "professionnel"],
      proName: "Aquitania Mutuelle",
      proSector: "Assurance & prévoyance",
      isAuthenticated: false,
      relationId: null,
      relationStatus: null,
      missingTierKeys: null,
    },
    {
      id: "mock-autoplus",
      name: "Reprise véhicule — offre cash sous 24 h",
      endsAt: inMin(34),
      brief:
        "Concession multimarque : prospects propriétaires d'un véhicule de moins de 8 ans envisageant une revente.",
      multiplier: 2,
      costPerContactCents: 720,
      founderBonusApplied: false,
      founderVipBonusApplied: false,
      requiredTiers: [1, 2, 3],
      requiredTierKeys: ["identity", "localisation", "vie"],
      proName: "AutoPlus Béarn",
      proSector: "Automobile",
      isAuthenticated: false,
      relationId: null,
      relationStatus: null,
      missingTierKeys: null,
    },
    {
      id: "mock-coach-attitude",
      name: "Coaching nutrition — bilan offert",
      endsAt: inMin(49),
      brief:
        "Coach nutrition diplômée : prospects 30-50 ans en quête d'un suivi alimentaire personnalisé.",
      multiplier: 4,
      costPerContactCents: 580,
      founderBonusApplied: false,
      founderVipBonusApplied: false,
      requiredTiers: [1, 2, 3],
      requiredTierKeys: ["identity", "localisation", "vie"],
      proName: "Coach Attitude",
      proSector: "Bien-être & santé",
      isAuthenticated: false,
      relationId: null,
      relationStatus: null,
      missingTierKeys: null,
    },
  ];
}

function FlashDeal() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { guard, modal: roleModal } = useRoleGuard();
  // Un compte professionnel peut consulter le DÉTAIL d'une offre (flash
  // deal / campagne) mais ne peut PAS l'accepter — ce sont les prospects
  // qui acceptent, les pros qui lancent. On ouvre donc la modale pour
  // tout le monde ; côté pro, elle s'affiche en lecture seule (pas de
  // boutons Accepter / Refuser, cf. `isPro` dans FlashDealModal).
  const { role: currentUserRole } = useCurrentRole();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const requestOpenDeal = (id: string) => {
    setOpenDealId(id);
  };
  // Mock deals générés une seule fois au montage — leurs timers
  // décomptent normalement et restent stables entre re-renders.
  const [mockSeedNow] = useState<number>(() => Date.now());
  const mockDeals = useMemo(
    () => buildMockDeals(mockSeedNow),
    [mockSeedNow],
  );
  // Décisions déjà prises sur les mocks (localStorage). On rerend
  // quand le store change pour que la modale, si on rouvre le même
  // mock, reflète l'état "déjà acceptée" / "déjà refusée".
  const [mockDecisions, setMockDecisions] = useState<MockDecisionStore>({});
  useEffect(() => {
    const sync = () => setMockDecisions(readMockDecisions());
    sync();
    window.addEventListener(MOCK_DECISIONS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MOCK_DECISIONS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Reprise post-authentification : si la home est ouverte avec
  // `?deal=<id>`, on ré-ouvre la modale correspondante dès que les
  // deals sont chargés. Le param est consommé une seule fois et l'URL
  // est nettoyée pour ne pas re-déclencher la modale après un refresh.
  const searchParams = useSearchParams();
  const requestedDealId = searchParams.get("deal");
  const [autoOpenConsumed, setAutoOpenConsumed] = useState(false);
  useEffect(() => {
    if (autoOpenConsumed) return;
    if (!requestedDealId) return;
    if (deals === null) return;
    // One-shot driven par un side-input externe (URL après auth Clerk) :
    // setState ici est intentionnel, pas un dérivé de props/state.
    // Comme le clic direct : on ouvre le détail pour tout le monde ; un
    // pro le verra en lecture seule (pas de boutons d'acceptation).
    /* eslint-disable react-hooks/set-state-in-effect */
    setOpenDealId(requestedDealId);
    setAutoOpenConsumed(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("deal");
      const cleaned = url.pathname + (url.search ? url.search : "") + url.hash;
      window.history.replaceState({}, "", cleaned);
    }
  }, [autoOpenConsumed, requestedDealId, deals, currentUserRole]);

  const load = async () => {
    try {
      const r = await fetch("/api/landing/flash-deals", { cache: "no-store" });
      if (!r.ok) {
        setDeals([]);
        return;
      }
      const j = await r.json();
      setDeals((j.deals || []) as Deal[]);
    } catch {
      setDeals([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const safeLoad = () => {
      if (!cancelled) void load();
    };
    safeLoad();
    const t = setInterval(safeLoad, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
      clearInterval(tick);
    };
  }, []);

  // Filtre les deals dont le timer est déjà à 0 — on évite de garder à
  // l'écran un item qui aurait expiré entre deux refetch.
  const realDeals = (deals ?? []).filter(
    (d) => new Date(d.endsAt).getTime() - now > 0,
  );
  // Tant que l'API n'a pas répondu (`deals === null`), on attend.
  // Une fois chargée, si aucune vraie campagne n'est active, on retombe
  // sur 4 deals fictifs pour démo / mise en scène de la home.
  const useFallback = deals !== null && realDeals.length === 0;
  // Mocks injectés client-side : `isAuthenticated` est forcé à false
  // dans buildMockDeals(). On le réaligne ici sur l'état Clerk réel
  // pour que le modal n'affiche pas le bouton "Créer un compte" à un
  // utilisateur déjà connecté. On hydrate également `relationStatus`
  // depuis le store local pour qu'un mock déjà accepté/refusé bascule
  // automatiquement en mode "already_*" dans la modale.
  const liveDeals = useFallback
    ? mockDeals
        .filter((d) => new Date(d.endsAt).getTime() - now > 0)
        .map((d) => {
          const rec = mockDecisions[d.id];
          return {
            ...d,
            isAuthenticated: !!isSignedIn,
            relationStatus: rec ? rec.decision : null,
          };
        })
    : realDeals;
  if (liveDeals.length === 0) return null;

  // Durée d'animation proportionnelle au nombre de deals — plus il y en a,
  // plus la piste est longue, donc on rallonge le défilement pour rester
  // lisible (env. 14s par deal).
  const marqueeDuration = `${Math.max(20, liveDeals.length * 14)}s`;
  const openDeal = liveDeals.find((d) => d.id === openDealId) ?? null;

  // On duplique deux fois la liste de deals pour que la boucle paraisse
  // continue (sans saut visible).
  const trackItems = [...liveDeals, ...liveDeals];

  const fmtHms = (target: string) => {
    const left = Math.max(
      0,
      Math.floor((new Date(target).getTime() - now) / 1000),
    );
    return `${String(Math.floor(left / 3600)).padStart(2, "0")}:${String(
      Math.floor((left % 3600) / 60),
    ).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  };

  return (
    <>
      <section className="flash-deal-banner" aria-label="Flash deals en cours">
        <div className="flash-deal-row">
          <span className="flash-deal-badge">
            <Icon name="bolt" size={13} /> Flash Deal
          </span>
          <div className="flash-deal-marquee">
            <div
              className="flash-deal-marquee-track"
              style={{ "--marquee-duration": marqueeDuration } as CSSProperties}
            >
              {trackItems.map((d, i) => {
                const multStr = fmtMultiplier(d.multiplier);
                const reward = (Number(d.costPerContactCents ?? 0) / 100)
                  .toFixed(2)
                  .replace(".", ",");
                const hms = fmtHms(d.endsAt);
                return (
                  <Fragment key={`${d.id}-${i}`}>
                    <button
                      type="button"
                      className="flash-deal-item"
                      onClick={() => requestOpenDeal(d.id)}
                      aria-label={`Voir ${d.proName ?? "l'offre"} — ${multStr}, expire dans ${hms}`}
                    >
                      <span className="mult-pill">{multStr}</span>
                      {d.proName ? (
                        <span className="pro-name">{d.proName}</span>
                      ) : null}
                      {d.proSector ? (
                        <>
                          <span className="sep">·</span>
                          <span>{d.proSector}</span>
                        </>
                      ) : null}
                      <span className="sep">·</span>
                      <strong style={{ color: "var(--ink)" }}>
                        {reward} €
                      </strong>
                      <span className="flash-deal-item-timer">
                        <Icon name="clock" size={11} />
                        {hms}
                      </span>
                      <span className="flash-deal-item-cta">
                        Voir le détail <Icon name="arrow" size={11} />
                      </span>
                    </button>
                    <span
                      className="flash-deal-divider-dot"
                      aria-hidden="true"
                    />
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      {openDeal && (
        <FlashDealModal
          deal={openDeal}
          isPro={currentUserRole === "pro"}
          remainingHms={(() => {
            const lf = Math.max(
              0,
              Math.floor((new Date(openDeal.endsAt).getTime() - now) / 1000),
            );
            return `${String(Math.floor(lf / 3600)).padStart(2, "0")}:${String(
              Math.floor((lf % 3600) / 60),
            ).padStart(2, "0")}:${String(lf % 60).padStart(2, "0")}`;
          })()}
          onClose={() => setOpenDealId(null)}
          onAfterDecision={async () => {
            await load();
            setOpenDealId(null);
          }}
          goAuth={() => {
            // Après authentification (Clerk), revenir sur la home en
            // ré-ouvrant la modale du flash deal cliqué via `?deal=<id>`.
            // L'effet d'hydratation côté FlashDeal détecte ce param et
            // appelle setOpenDealId, puis nettoie l'URL.
            const dealId = openDeal?.id ?? "";
            const redirect = dealId
              ? `/?deal=${encodeURIComponent(dealId)}`
              : "/";
            router.push(
              `/inscription/prospect?redirect_url=${encodeURIComponent(redirect)}`,
            );
          }}
          goDonnees={(tier) =>
            guard(
              "prospect",
              `/prospect?tab=donnees${tier ? `&scrollTier=${tier}` : ""}`,
            )
          }
        />
      )}
      {roleModal}
    </>
  );
}

function FlashDealModal({
  deal,
  isPro,
  remainingHms,
  onClose,
  onAfterDecision,
  goAuth,
  goDonnees,
}: {
  deal: Deal;
  isPro: boolean;
  remainingHms: string;
  onClose: () => void;
  onAfterDecision: () => Promise<void>;
  goAuth: () => void;
  goDonnees: (tier?: number) => void;
}) {
  // Mock deals injectés sur la home quand aucune campagne réelle n'est
  // active : ils n'existent pas en base, donc accept/refuse est simulé
  // localement (cf. decide()) pour préserver l'UX complète.
  const isMock = deal.id.startsWith("mock-");
  const { signOut } = useClerk();
  const [submitting, setSubmitting] = useState<"accept" | "refuse" | null>(
    null,
  );
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Côté pro (lecture seule) : déconnexion puis retour au login pour se
  // reconnecter avec un compte prospect — seul rôle habilité à accepter.
  const switchToProspect = async () => {
    setSwitchingAccount(true);
    try {
      await signOut({ redirectUrl: "/connexion" });
    } catch (err) {
      console.error("[FlashDealModal] signOut failed", err);
      setSwitchingAccount(false);
    }
  };
  const multStr = fmtMultiplier(deal.multiplier);
  const rewardEur = (Number(deal.costPerContactCents ?? 0) / 100)
    .toFixed(2)
    .replace(".", ",");
  const requiredLabels = (deal.requiredTierKeys || []).map(
    (k) => TIER_KEY_LABEL_FR[k] || k,
  );
  const missingLabels = (deal.missingTierKeys || []).map(
    (k) => TIER_KEY_LABEL_FR[k] || k,
  );
  // Premier palier manquant (numéro le plus bas) → scroll direct dans
  // « Mes données ».
  const firstMissingTier =
    (deal.missingTierKeys || [])
      .map((k) => TIER_NUM_BY_KEY[k])
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => a - b)[0] ?? undefined;

  let mode: string;
  // Un compte professionnel peut consulter le détail mais pas accepter :
  // on court-circuite tous les autres modes pour n'afficher qu'un encart
  // explicatif en lecture seule (aucun bouton Accepter / Refuser).
  if (isPro) mode = "pro_readonly";
  else if (!deal.isAuthenticated) mode = "auth";
  else if (deal.relationStatus === "pending") mode = "decide";
  else if (deal.relationStatus) mode = "already_" + deal.relationStatus;
  else if (isMock) mode = "decide";
  else if (
    Array.isArray(deal.missingTierKeys) &&
    deal.missingTierKeys.length > 0
  )
    mode = "fill_data";
  else mode = "no_match";

  // Traduit les codes d'erreur de /api/prospect/relations/[id]/decision
  // en messages lisibles côté UI. Aligne le vocabulaire de la modale
  // flash deal sur celui du dashboard prospect (onglet Mises en relation).
  // `insufficient_pro_funds` est le cas le plus visible côté démo : un
  // pro fictif avec wallet à 0 € voit `accept_relation_tx` raise — on
  // explique au prospect que ce n'est pas sa décision qui est en cause.
  // Pour `rate_limited`, on préfère le message serveur car il contient
  // le countdown dynamique (Réessayez dans X min Y s).
  const friendlyDecisionError = (
    code: string | undefined,
    serverMessage?: string,
  ): string => {
    if (code === "rate_limited" && serverMessage) return serverMessage;
    if (code === "rate_limited")
      return "Pas trop vite 😊 vous pouvez accepter ou refuser une sollicitation toutes les 5 minutes.";
    if (!code) return "Erreur — réessayez dans un instant.";
    if (code === "insufficient_pro_funds")
      return "Ce professionnel n'a plus de fonds disponibles pour cette campagne. Réessayez plus tard, ou choisissez une autre offre.";
    if (code === "campaign_inactive")
      return "Cette campagne n'est plus active — elle a été clôturée par le professionnel.";
    if (code === "campaign_expired")
      return "Cette campagne est terminée — elle a atteint sa date de fin.";
    if (code === "relation_expired")
      return "Le délai pour répondre à cette sollicitation est dépassé.";
    if (code === "invalid_status")
      return "Cette décision n'est plus possible (statut incompatible).";
    if (code === "relation_not_found")
      return "Sollicitation introuvable — elle a peut-être été retirée.";
    if (code === "forbidden")
      return "Cette sollicitation ne vous est plus accessible.";
    return "Erreur — réessayez dans un instant.";
  };

  // Helper qui parse une réponse non-ok et throw une Error enrichie d'un
  // serverMessage exploitable côté catch → friendlyDecisionError.
  const throwApiError = async (response: Response): Promise<never> => {
    const j = await response.json().catch(() => ({}));
    const err = new Error(j?.error || "");
    (err as Error & { serverMessage?: string }).serverMessage = j?.message;
    throw err;
  };
  const extractServerMessage = (e: unknown): string | undefined =>
    e instanceof Error
      ? (e as Error & { serverMessage?: string }).serverMessage
      : undefined;

  const decide = async (action: "accept" | "refuse") => {
    // Rate-limit client (mocks ET vraies décisions) : 1 / 5 min — aligné
    // sur le rate-limit serveur. Les mocks bypassent l'API, donc sans
    // ce guard l'utilisateur pouvait spammer Accept/Refuse.
    const left = decisionCooldownLeftMs(deal.id);
    if (left > 0) {
      setError(buildCooldownMessage(left));
      return;
    }
    // Deals fictifs : pas de relation en base, on simule la décision
    // pour rendre le flux complet utilisable en démo. La décision est
    // persistée dans localStorage pour (a) afficher l'état "déjà
    // acceptée/refusée" si la modale est rouverte et (b) que le
    // prototype prospect puisse afficher ces décisions dans l'onglet
    // Mises en relation.
    if (isMock) {
      setSubmitting(action);
      setError(null);
      setTimeout(() => {
        writeMockDecision(deal, action === "accept" ? "accepted" : "refused");
        setLastDecisionAtFor(deal.id, Date.now());
        setSubmitting(null);
        onClose();
      }, 400);
      return;
    }
    if (!deal.relationId) return;
    setSubmitting(action);
    setError(null);
    try {
      const r = await fetch(
        `/api/prospect/relations/${deal.relationId}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (!r.ok) await throwApiError(r);
      setLastDecisionAtFor(deal.id, Date.now());
      await onAfterDecision();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(friendlyDecisionError(code, extractServerMessage(e)));
    } finally {
      setSubmitting(null);
    }
  };

  // Bascule accepted → refused tant que la campagne tourne encore.
  // Côté API, l'endpoint /decision accepte directement `refuse` depuis
  // un statut accepted (RPC refund_relation_tx). Pour les mocks, on
  // ré-écrit simplement la décision dans localStorage.
  const refuseAfterAccepted = async () => {
    const left = decisionCooldownLeftMs(deal.id);
    if (left > 0) {
      setError(buildCooldownMessage(left));
      return;
    }
    if (isMock) {
      setSubmitting("refuse");
      setError(null);
      setTimeout(() => {
        writeMockDecision(deal, "refused");
        setLastDecisionAtFor(deal.id, Date.now());
        setSubmitting(null);
        onClose();
      }, 400);
      return;
    }
    if (!deal.relationId) return;
    setSubmitting("refuse");
    setError(null);
    try {
      const r = await fetch(
        `/api/prospect/relations/${deal.relationId}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "refuse" }),
        },
      );
      if (!r.ok) await throwApiError(r);
      setLastDecisionAtFor(deal.id, Date.now());
      await onAfterDecision();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(friendlyDecisionError(code, extractServerMessage(e)));
    } finally {
      setSubmitting(null);
    }
  };

  // Reprend la main sur une relation refusée : undo (refused → pending),
  // puis accept (pending → accepted). Utilisé tant que la campagne est
  // toujours active.
  const acceptAfterRefused = async () => {
    const left = decisionCooldownLeftMs(deal.id);
    if (left > 0) {
      setError(buildCooldownMessage(left));
      return;
    }
    // Mock : on bascule directement la décision persistée en "accepted".
    if (isMock) {
      setSubmitting("accept");
      setError(null);
      setTimeout(() => {
        writeMockDecision(deal, "accepted");
        setLastDecisionAtFor(deal.id, Date.now());
        setSubmitting(null);
        onClose();
      }, 400);
      return;
    }
    if (!deal.relationId) return;
    setSubmitting("accept");
    setError(null);
    try {
      const undo = await fetch(
        `/api/prospect/relations/${deal.relationId}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "undo" }),
        },
      );
      if (!undo.ok) await throwApiError(undo);
      const acc = await fetch(
        `/api/prospect/relations/${deal.relationId}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "accept" }),
        },
      );
      if (!acc.ok) await throwApiError(acc);
      setLastDecisionAtFor(deal.id, Date.now());
      await onAfterDecision();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(friendlyDecisionError(code, extractServerMessage(e)));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,22,41,.55)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 540,
          background: "var(--paper)",
          borderRadius: 16,
          padding: "clamp(20px, 4vw, 30px)",
          boxShadow:
            "0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)",
          margin: "auto 0",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          className="row between"
          style={{ alignItems: "flex-start", marginBottom: 14, gap: 10 }}
        >
          <div className="row center gap-2" style={{ flexWrap: "wrap" }}>
            <span
              className="badge"
              style={{
                background: "var(--ink)",
                color: "var(--paper)",
                borderColor: "var(--ink)",
              }}
            >
              <Icon name="bolt" size={11} /> Flash Deal
            </span>
            <span
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 999,
                background: "color-mix(in oklab, #B91C1C 12%, var(--paper))",
                border:
                  "1px solid color-mix(in oklab, #B91C1C 30%, var(--line))",
                color: "#B91C1C",
              }}
            >
              Gains {multStr}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-4)",
              padding: 4,
            }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div
          className="serif"
          style={{ fontSize: 22, lineHeight: 1.2, marginBottom: 4 }}
        >
          {deal.proName || "BUUPP"}
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
          {deal.proSector ? deal.proSector + " · " : ""}
          {deal.name}
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "var(--ink)",
            color: "var(--paper)",
            marginBottom: 14,
          }}
        >
          <div
            className="mono caps"
            style={{
              fontSize: 10,
              letterSpacing: ".12em",
              color: "#A8AFC0",
            }}
          >
            Récompense
          </div>
          <div
            className="serif tnum"
            style={{ fontSize: 32, fontWeight: 600, marginTop: 4 }}
          >
            {rewardEur} €
          </div>
          {deal.founderVipBonusApplied ? (
            <div
              className="mono caps"
              style={{
                marginTop: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 999,
                background: "linear-gradient(135deg,#FEF3C7,#FCD34D)",
                color: "#78350F",
                border: "1px solid #B45309",
                fontSize: 11,
                letterSpacing: ".06em",
                fontWeight: 700,
              }}
            >
              🏆 Bonus parrain VIP +5 €
            </div>
          ) : deal.founderBonusApplied ? (
            <div
              className="mono caps"
              style={{
                marginTop: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 999,
                background: "#FFF1B8",
                color: "#5C4400",
                border: "1px solid #F2C879",
                fontSize: 11,
                letterSpacing: ".06em",
              }}
            >
              🎖️ Bonus fondateur ×2
            </div>
          ) : null}
          <div style={{ fontSize: 12, color: "#A8AFC0", marginTop: 4 }}>
            Gains multipliés{" "}
            <strong style={{ color: "#FFFEF8" }}>{multStr}</strong> — fenêtre
            éclair
          </div>
        </div>

        <div
          className="row center gap-2"
          style={{ marginBottom: 16, fontSize: 13, color: "var(--ink-2)" }}
        >
          <Icon name="clock" size={14} />
          <span>
            Plus que <strong className="mono tnum">{remainingHms}</strong> pour
            décider.
          </span>
        </div>

        {deal.brief && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--ivory-2)",
              border: "1px solid var(--line-2)",
              marginBottom: 14,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--ink-2)",
            }}
          >
            <div
              className="mono caps muted"
              style={{ fontSize: 10, letterSpacing: ".12em", marginBottom: 4 }}
            >
              Le mot du professionnel
            </div>
            <div>« {deal.brief} »</div>
          </div>
        )}

        {requiredLabels.length > 0 && (
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
            Données demandées :{" "}
            {requiredLabels.map((l, i) => (
              <span
                key={i}
                className="chip"
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  marginRight: 4,
                  marginBottom: 4,
                }}
              >
                {l}
              </span>
            ))}
          </div>
        )}

        {mode === "pro_readonly" && (
          <>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background:
                  "color-mix(in oklab, var(--accent) 7%, var(--paper))",
                border:
                  "1px solid color-mix(in oklab, var(--accent) 30%, var(--line))",
                fontSize: 13,
                color: "var(--ink-2)",
                lineHeight: 1.55,
                marginBottom: 14,
              }}
            >
              <div
                className="mono caps"
                style={{
                  fontSize: 10,
                  letterSpacing: ".14em",
                  color: "var(--accent)",
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                Compte professionnel
              </div>
              Vous consultez cette offre avec un compte{" "}
              <strong>professionnel</strong>. Sur BUUPP, les professionnels{" "}
              <strong>lancent</strong> des campagnes&nbsp;; seuls les{" "}
              <strong>prospects</strong> peuvent les accepter. Pour accepter
              cette offre, connectez-vous avec un compte prospect.
            </div>
            <button
              type="button"
              onClick={switchToProspect}
              disabled={switchingAccount}
              className="btn btn-lg"
              style={{
                width: "100%",
                justifyContent: "center",
                background: "var(--ink)",
                color: "var(--paper)",
                opacity: switchingAccount ? 0.6 : 1,
              }}
            >
              {switchingAccount ? (
                "Déconnexion…"
              ) : (
                <>
                  Utiliser un compte prospect <Icon name="arrow" size={14} />
                </>
              )}
            </button>
          </>
        )}

        {mode === "auth" && (
          <>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background:
                  "color-mix(in oklab, var(--accent) 7%, var(--paper))",
                border:
                  "1px solid color-mix(in oklab, var(--accent) 30%, var(--line))",
                fontSize: 13,
                color: "var(--ink-2)",
                marginBottom: 14,
              }}
            >
              Pour accepter ou refuser cette offre, vous devez d&apos;abord
              créer votre compte BUUPP.
            </div>
            <button
              onClick={goAuth}
              className="btn btn-lg"
              style={{
                width: "100%",
                justifyContent: "center",
                background: "var(--ink)",
                color: "var(--paper)",
              }}
            >
              Créer un compte / Se connecter <Icon name="arrow" size={14} />
            </button>
          </>
        )}

        {mode === "decide" && (
          <>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              <button
                onClick={() => decide("refuse")}
                disabled={!!submitting}
                className="btn"
                style={{
                  flex: "1 1 160px",
                  justifyContent: "center",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  border: "1.5px solid var(--line-2)",
                  opacity: submitting && submitting !== "refuse" ? 0.5 : 1,
                }}
              >
                {submitting === "refuse" ? "Refus en cours…" : "Refuser"}
              </button>
              <button
                onClick={() => decide("accept")}
                disabled={!!submitting}
                className="btn"
                style={{
                  flex: "1 1 160px",
                  justifyContent: "center",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  opacity: submitting && submitting !== "accept" ? 0.5 : 1,
                }}
              >
                {submitting === "accept" ? (
                  "Acceptation…"
                ) : (
                  <>
                    Accepter <Icon name="check" size={13} />
                  </>
                )}
              </button>
            </div>
            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#FEF2F2",
                  border: "1.5px solid #FECACA",
                  color: "#991B1B",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
          </>
        )}

        {mode === "fill_data" && (
          <>
            <div
              role="alert"
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "color-mix(in oklab, #B45309 7%, var(--paper))",
                border:
                  "1px solid color-mix(in oklab, #B45309 30%, var(--line))",
                fontSize: 13,
                color: "var(--ink-2)",
                lineHeight: 1.55,
                marginBottom: 14,
              }}
            >
              {deal.proName || "Le professionnel"} souhaite obtenir vos données
              de{" "}
              <strong style={{ color: "#B45309" }}>
                {missingLabels.length === 1
                  ? missingLabels[0]
                  : missingLabels.slice(0, -1).join(", ") +
                    " et " +
                    missingLabels.slice(-1)}
              </strong>
              , mais vous ne les avez pas encore renseignées. Complétez votre
              profil pour pouvoir bénéficier de cette offre.
            </div>
            <button
              onClick={() => goDonnees(firstMissingTier)}
              className="btn btn-lg"
              style={{
                width: "100%",
                justifyContent: "center",
                background: "var(--ink)",
                color: "var(--paper)",
              }}
            >
              Compléter mes données <Icon name="arrow" size={14} />
            </button>
          </>
        )}

        {mode === "no_match" && (
          <>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--ivory-2)",
                border: "1px solid var(--line-2)",
                fontSize: 13,
                color: "var(--ink-2)",
                lineHeight: 1.55,
                marginBottom: 12,
              }}
            >
              Cette campagne ne correspond pas à votre profil (zone
              géographique, tranche d&apos;âge ou centres d&apos;intérêt).
              Complétez vos données pour augmenter vos chances d&apos;être
              éligible.
            </div>
            <button
              onClick={() => goDonnees()}
              className="btn btn-lg"
              style={{
                width: "100%",
                justifyContent: "center",
                background: "var(--ink)",
                color: "var(--paper)",
                whiteSpace: "normal",
                lineHeight: 1.3,
                textAlign: "center",
                flexWrap: "wrap",
              }}
            >
              Compléter mes données pour accepter le{" "}
              <span
                style={{
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                deal <Icon name="arrow" size={14} />
              </span>
            </button>
          </>
        )}

        {mode === "already_refused" && (
          <>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--ivory-2)",
                border: "1px solid var(--line-2)",
                fontSize: 13,
                color: "var(--ink-2)",
                lineHeight: 1.55,
                marginBottom: 12,
              }}
            >
              <div style={{ marginBottom: 4 }}>
                Vous avez refusé cette sollicitation.
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                La campagne est encore active : vous pouvez changer d&apos;avis
                et accepter tant qu&apos;elle n&apos;est pas clôturée.
              </div>
            </div>
            <button
              onClick={acceptAfterRefused}
              disabled={!!submitting}
              className="btn btn-lg"
              style={{
                width: "100%",
                justifyContent: "center",
                background: "var(--ink)",
                color: "var(--paper)",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting === "accept" ? (
                "Acceptation en cours…"
              ) : (
                <>
                  Accepter finalement <Icon name="check" size={14} />
                </>
              )}
            </button>
            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#FEF2F2",
                  border: "1.5px solid #FECACA",
                  color: "#991B1B",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
          </>
        )}

        {mode === "already_accepted" && (
          <>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background:
                  "color-mix(in oklab, var(--good, #16A34A) 8%, var(--paper))",
                border:
                  "1px solid color-mix(in oklab, var(--good, #16A34A) 35%, var(--line))",
                fontSize: 13,
                color: "var(--ink-2)",
                lineHeight: 1.55,
                marginBottom: 12,
              }}
            >
              <div style={{ marginBottom: 4 }}>
                ✓ Sollicitation déjà acceptée.
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                La campagne est encore active : vous pouvez changer
                d&apos;avis et refuser tant qu&apos;elle n&apos;est pas
                clôturée.
              </div>
            </div>
            <button
              onClick={refuseAfterAccepted}
              disabled={!!submitting}
              className="btn btn-lg"
              style={{
                width: "100%",
                justifyContent: "center",
                background: "var(--paper)",
                color: "var(--ink)",
                border: "1.5px solid var(--line-2)",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting === "refuse"
                ? "Refus en cours…"
                : "Refuser finalement"}
            </button>
            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#FEF2F2",
                  border: "1.5px solid #FECACA",
                  color: "#991B1B",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
          </>
        )}

        {(mode === "already_expired" || mode === "already_settled") && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--ivory-2)",
              border: "1px solid var(--line-2)",
              fontSize: 13,
              color: "var(--ink-2)",
              lineHeight: 1.55,
            }}
          >
            {mode === "already_expired" && "Cette sollicitation a expiré."}
            {mode === "already_settled" &&
              "✓ Sollicitation déjà acceptée — gains crédités."}
          </div>
        )}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Créez votre profil",
      body: "Renseignez uniquement ce que vous acceptez de partager, par paliers. Chaque palier validé augmente votre BUUPP Score et vos gains potentiels.",
    },
    {
      n: "02",
      title: "Choisissez vos contacts",
      body: "Vous recevez des demandes ciblées et vérifiées. Acceptez ou refusez la sollicitation. Les données vous appartiennent.",
    },
    {
      n: "03",
      title: "Encaissez vos gains",
      body: "Chaque demande acceptée crédite automatiquement votre portefeuille. Retrait par IBAN, carte cadeau ou don associatif.",
    },
  ];
  return (
    <section id="prospects" className="section">
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          className="row between wrap"
          style={{ marginBottom: 48, gap: 24, alignItems: "flex-end" }}
        >
          <div style={{ maxWidth: 720 }}>
            <div
              className="mono caps"
              style={{
                fontSize: 11,
                letterSpacing: ".18em",
                color: "var(--accent)",
                marginBottom: 16,
              }}
            >
              — Pour les prospects
            </div>
            <h2 className="serif" style={{ letterSpacing: "0.06em" }}>
              Enfin <em>rémunéré</em>
              <br />
              pour votre attention.
            </h2>
            <p
              className="muted"
              style={{
                fontSize: "clamp(15px, 1.6vw, 18px)",
                lineHeight: 1.55,
                marginTop: 20,
                maxWidth: 560,
              }}
            >
              En trois gestes simples, vous choisissez qui peut vous contacter —
              et à quel prix. Le consentement est au centre. Aucune donnée
              n&apos;est transmise avant que vous ne confirmiez la mise en
              relation.
            </p>
          </div>
        </div>
        <div
          className="grid grid-3 steps-grid"
          style={{ gap: 0, borderTop: "1px solid var(--line)" }}
        >
          {steps.map((s, i) => (
            <div
              key={i}
              className={`step-cell step-cell-${i}`}
              style={{
                borderRight: i < 2 ? "1px solid var(--line)" : "none",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 24,
                  color: "var(--accent)",
                  marginBottom: 16,
                }}
              >
                {s.n}
              </div>
              <h3 className="serif" style={{ marginBottom: 12 }}>
                {s.title}
              </h3>
              <p className="muted" style={{ fontSize: 14 }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TiersTable() {
  const [verified, setVerified] = useState(false);
  return (
    <section
      id="tiers"
      className="section-sm"
      style={{
        background: "var(--paper)",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          className="row between wrap"
          style={{ marginBottom: 36, gap: 16, alignItems: "flex-end" }}
        >
          <div>
            <div className="mono caps muted" style={{ marginBottom: 14 }}>
              — Grille de rémunération
            </div>
            <h2 className="serif" style={{ letterSpacing: "0.06em" }}>
              Cinq paliers.
              <br />
              <em style={{ letterSpacing: "0.06em" }}>Un prix par palier.</em>
            </h2>
          </div>
          <label
            className="row center gap-3"
            style={{ cursor: "pointer", userSelect: "none" }}
          >
            <span
              className="muted"
              style={{ fontSize: 13, letterSpacing: "0.08em" }}
            >
              Afficher les gains Prospect{" "}
              <span style={{ color: "#7C3AED", fontWeight: 600 }}>
                certifié confiance
              </span>
            </span>
            <span
              onClick={() => setVerified(!verified)}
              style={{
                width: 42,
                height: 24,
                borderRadius: 999,
                background: verified ? "var(--accent)" : "var(--line-2)",
                position: "relative",
                transition: "background .2s",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: verified ? 21 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: "white",
                  transition: "left .2s",
                  boxShadow: "0 1px 2px rgba(0,0,0,.15)",
                }}
              />
            </span>
          </label>
        </div>

        <div
          className="card"
          style={{ background: "var(--ivory)", padding: 0, overflow: "hidden" }}
        >
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table className="tbl" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Palier</th>
                  <th>Catégorie</th>
                  <th>Exemples de données</th>
                  <th style={{ textAlign: "right", width: 200 }}>
                    Rémunération
                  </th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => (
                  <tr key={t.n}>
                    <td>
                      <div className="serif tnum" style={{ fontSize: 28 }}>
                        {t.n}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>
                        {t.name}
                      </div>
                    </td>
                    <td className="muted">{t.ex}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className="mono tnum" style={{ fontSize: 14 }}>
                        {verified ? (
                          <span>
                            <span
                              style={{
                                textDecoration: "line-through",
                                color: "var(--ink-5)",
                                marginRight: 8,
                              }}
                            >
                              {t.range}
                            </span>
                            <span style={{ color: "var(--accent)" }}>
                              {t.low === t.high
                                ? `minimum ${(t.low * 2).toFixed(2).replace(".", ",")} €`
                                : `${(t.low * 2).toFixed(2).replace(".", ",")} € – ${(t.high * 2).toFixed(2).replace(".", ",")} €`}
                            </span>
                          </span>
                        ) : (
                          t.range
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--line)",
              background: "var(--ivory-2)",
            }}
            className="row between center wrap gap-2"
          >
            <div className="muted flex items-center" style={{ fontSize: 13 }}>
              <Icon name="sparkle" size={13} />{" "}
              <span
                style={{
                  marginLeft: 6,
                  verticalAlign: "middle",
                  letterSpacing: "0.08em",
                }}
              >
                Prospect vérifié 100% → meilleurs gains
              </span>
            </div>
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--ink-4)" }}
            >
              Fourchette d&apos;estimation par campagne
            </div>
          </div>
        </div>
      </div>
    </section>
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
  const [fiabInfo, setFiabInfo] = useState(false);
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
                      <button
                        type="button"
                        onClick={() => setFiabInfo(true)}
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
                      </button>
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

      {fiabInfo && <FiabiliteInfoModal onClose={() => setFiabInfo(false)} />}
    </>
  );
}

/* ── Indice de désirabilité — scène épinglée (scroll-driven storytelling) ──
   En arrivant sur la section, l'écran se fige ; au défilement, trois popups
   se succèdent (paliers → fraîcheur → fiabilité) pour rappeler que la qualité
   de l'indice de désirabilité conditionne le volume de sollicitations reçues.
   Technique : conteneur haut + enfant `position: sticky` piloté par la
   progression du scroll NATIF (pas de scroll-jacking → scroll tactile imbriqué
   et accessibilité préservés). Repli statique si prefers-reduced-motion. */

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

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/* Opacité + décalage vertical d'un popup selon la progression p∈[0,1]. */
function popupVis(
  p: number,
  enter: number,
  full: number,
  hold: number,
  exit: number,
): { o: number; y: number } {
  if (p <= enter || p >= exit) return { o: 0, y: p <= enter ? 30 : -30 };
  if (p < full) {
    const t = (p - enter) / (full - enter);
    return { o: t, y: (1 - t) * 30 };
  }
  if (p < hold) return { o: 1, y: 0 };
  const t = (p - hold) / (exit - hold);
  return { o: 1 - t, y: -t * 30 };
}

// Bandes [enter, full, hold, exit] de chaque popup sur la progression de la scène.
const DESIR_BANDS: ReadonlyArray<[number, number, number, number]> = [
  [0.03, 0.12, 0.28, 0.36],
  [0.38, 0.47, 0.61, 0.68],
  [0.7, 0.79, 0.94, 0.995],
];

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
        maxWidth: 600,
        maxHeight: "100%",
        overflowY: "auto",
        background: C.card,
        borderRadius: 18,
        boxShadow: "0 30px 80px rgba(22,26,29,0.28)",
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

function DesirabiliteScene() {
  const reduced = usePrefersReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const el = trackRef.current;
      if (!el) return;
      const vh = window.innerHeight;
      const total = el.offsetHeight - vh;
      const scrolled = -el.getBoundingClientRect().top;
      setP(total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // Repli statique (accessibilité) : la carte score puis les trois popups empilés.
  if (reduced) {
    return (
      <section className="section">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <ScoreVisual />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
              marginTop: 48,
            }}
          >
            {DESIR_POPUPS.map((pp) => (
              <ScorePopupCard
                key={pp.key}
                accent={pp.accent}
                icon={pp.icon}
                kicker={pp.kicker}
                title={pp.title}
              >
                {pp.body}
              </ScorePopupCard>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const vis = DESIR_BANDS.map((b) => popupVis(p, b[0], b[1], b[2], b[3]));
  const maxO = Math.max(vis[0].o, vis[1].o, vis[2].o);
  const backdrop = Math.min(0.55, maxO * 0.62);
  let active = -1;
  let best = 0.001;
  vis.forEach((v, i) => {
    if (v.o > best) {
      best = v.o;
      active = i;
    }
  });

  return (
    <section
      ref={trackRef}
      aria-label="Indice de désirabilité"
      style={{ position: "relative", height: "400vh" }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Fond : la carte « indice de désirabilité » */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            transition: "filter .4s ease",
            filter: backdrop > 0.05 ? "blur(2px)" : "none",
          }}
        >
          <div className="section" style={{ width: "100%" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
              <ScoreVisual />
            </div>
          </div>
        </div>

        {/* Voile sombre quand un popup est actif */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#0f1219",
            opacity: backdrop,
            pointerEvents: backdrop > 0.05 ? "auto" : "none",
            transition: "opacity .12s linear",
            zIndex: 2,
          }}
        />

        {/* Popups successifs */}
        {DESIR_POPUPS.map((pp, i) => (
          <div
            key={pp.key}
            aria-hidden={vis[i].o < 0.5}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "86px 16px 96px",
              opacity: vis[i].o,
              transform: `translateY(${vis[i].y}px) scale(${0.96 + 0.04 * vis[i].o})`,
              pointerEvents: vis[i].o > 0.5 ? "auto" : "none",
              zIndex: 3,
            }}
          >
            <ScorePopupCard
              accent={pp.accent}
              icon={pp.icon}
              kicker={pp.kicker}
              title={pp.title}
            >
              {pp.body}
            </ScorePopupCard>
          </div>
        ))}

        {/* Indicateur d'étapes + invite à défiler */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 22,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            zIndex: 4,
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            {DESIR_POPUPS.map((pp, i) => (
              <span
                key={pp.key}
                style={{
                  width: active === i ? 22 : 7,
                  height: 7,
                  borderRadius: 999,
                  background:
                    active === i
                      ? "#5a57d6"
                      : active >= 0
                        ? "rgba(255,255,255,0.5)"
                        : "var(--ink-4)",
                  transition: "all .25s ease",
                }}
              />
            ))}
          </div>
          <div
            className="mono caps"
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              color: active >= 0 ? "rgba(255,255,255,0.75)" : "var(--ink-4)",
              opacity: p > 0.92 ? 0 : 1,
              transition: "opacity .3s ease, color .2s ease",
            }}
          >
            Continuez à défiler ↓
          </div>
        </div>
      </div>
    </section>
  );
}

/* Popup « Comment se calcule le taux de fiabilité ? » — design repris de la
   maquette pop.png (palette premium indigo/teal/ambre/rose/vert). Icônes =
   jeu existant du site (SiteChrome). Responsive : carte scrollable, tuiles
   et exemples qui s'adaptent en largeur. */
function FiabiliteInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(15,18,25,0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <ScorePopupCard
        accent="linear-gradient(90deg, #4744bf 0%, #5a57d6 40%, #2e9e5b 100%)"
        icon="shield"
        kicker="BUUPP Score"
        title="Comment se calcule votre taux de fiabilité ?"
        onClose={onClose}
      >
        <FiabiliteBody />
      </ScorePopupCard>
    </div>
  );
}

function ProsSection() {
  const { guard, modal: roleModal } = useRoleGuard();
  const [demoOpen, setDemoOpen] = useState(false);
  const benefits: { ic: IconName; t: string; d: string; hi?: boolean }[] = [
    {
      ic: "check",
      hi: true,
      t: "Des prospects qui ont dit oui 2 fois",
      d: "Chaque contact que vous obtiendrez a accepté à 2 reprises, explicitement. Pas d'achat de fichier, pas de scraping, pas de cold call qui tombe dans le vide.",
    },
    {
      ic: "target",
      t: "Ciblage par paliers de données",
      d: "Payez uniquement pour ce dont vous avez besoin : identification, localisation, style de vie, profession, patrimoine. Budget maîtrisé au centime.",
    },
    {
      ic: "wallet",
      hi: true,
      t: "Vous ne payez que les acceptations",
      d: "Zéro frais caché, zéro clic douteux : vous n'êtes facturé que pour les prospects qui ont explicitement accepté d'être sollicités. Les refus et expirations sont gratuits.",
    },
    {
      ic: "clock",
      t: "Du temps commercial qui compte",
      d: "Vos équipes ne relancent plus dans le vide : chaque contact a explicitement accepté l'échange. Le temps passé va aux conversations voulues, pas aux numéros qui raccrochent.",
    },
    {
      ic: "gauge",
      hi: true,
      t: "BUUPP Score : qualité mesurée",
      d: "Chaque prospect est noté sur 1000 points selon la qualité de son profil et son historique. Filtrez à partir du score minimum qui vous convient.",
    },
    {
      ic: "bolt",
      t: "Mise en relation instantannée",
      d: "Campagne créée à 8h, premiers rendez-vous pris la minute d'après, dès acceptation. Plus d'intermédiaires, plus d'agences, plus de délais.",
    },
  ];

  const useCases: [string, string, string, string, string][] = [
    [
      "Artisan",
      "Menuisier, plombier, cuisiniste",
      "Rayon 30 km",
      "+ devis/mois",
      "4,20 €/contact",
    ],
    [
      "Professions libérales",
      "Kiné, dentiste, coach",
      "Rayon 15 km",
      "+ RDV/mois",
      "5,80 €/contact",
    ],
    [
      "Agences immobilières",
      "Vente, location, gestion",
      "Rayon 20 km",
      "+ leads/mois",
      "7,40 €/contact",
    ],
    [
      "SaaS & B2B",
      "Éditeurs, cabinets conseil",
      "National",
      "+ DL/mois",
      "2,90 €/contact",
    ],
  ];

  // Valeurs exprimées en emojis « ressenti » plutôt qu'en chiffres :
  // 📉 très faible (acceptation), 🤨 douteux (conformité), 💸 cher (coût).
  const classic: [string, string][] = [
    ["📉", "Taux d'acceptation"],
    ["🤨", "Conformité RGPD mesurée"],
    ["💸", "Coût moyen d'un lead qualifié"],
    ["🚫", "Aucune traçabilité du consentement"],
  ];

  const bupp: [string, string][] = [
    ["90%", "Taux d'acceptation moyen"],
    ["100%", "Double consentement horodaté"],
    ["à partir de 5 €", "Coût moyen d'un contact qualifié"],
    ["✓", "Watermarking + piste d'audit complète"],
  ];

  return (
    <section
      id="pros"
      className="section"
      data-nav-theme="dark"
      style={{ background: "var(--ink)", color: "var(--paper)" }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          className="row between wrap"
          style={{ alignItems: "flex-end", marginBottom: 48, gap: 24 }}
        >
          <div style={{ maxWidth: 640 }}>
            <div
              className="mono caps"
              style={{
                fontSize: 11,
                letterSpacing: ".18em",
                color: "#A5B4FC",
                marginBottom: 16,
              }}
            >
              — Pour les professionnels
            </div>
            <h2 className="serif" style={{ color: "var(--paper)" }}>
              Arrêtez de prospecter.
              <br />
              <em style={{ color: "#A5B4FC", letterSpacing: "0.08em" }}>
                Laissez vos prospects venir.
              </em>
            </h2>
            <p
              style={{
                fontSize: "clamp(15px, 1.6vw, 18px)",
                lineHeight: 1.55,
                color: "rgba(255,255,255,.72)",
                marginTop: 20,
              }}
            >
              L&apos;inbound, vraiment. Des contacts qui ont eux-mêmes accepté
              d&apos;être sollicités, pour des campagnes qui correspondent à
              leur profil et à leur moment de vie.
            </p>
          </div>
          <div className="row gap-3 wrap">
            <button
              className="btn btn-lg btn-block-mobile"
              onClick={() => guard("pro", "/pro", "/inscription/pro")}
              style={{ background: "var(--paper)", color: "var(--ink)" }}
            >
              Ouvrir un compte pro <Icon name="arrow" size={14} />
            </button>
            <button
              className="btn btn-lg btn-ghost btn-block-mobile"
              onClick={() => setDemoOpen(true)}
              style={{
                color: "var(--paper)",
                borderColor: "rgba(255,255,255,.28)",
              }}
            >
              Demandez une démo
            </button>
          </div>
        </div>

        <div
          className="grid grid-3"
          data-reveal-group
          style={{
            gap: 1,
            background: "rgba(255,255,255,.08)",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 64,
          }}
        >
          {benefits.map((b, i) => (
            <div
              key={i}
              style={{
                padding: 32,
                background: b.hi
                  ? "linear-gradient(160deg, rgba(165,180,252,.18) 0%, rgba(165,180,252,.06) 40%, #0F1629 100%)"
                  : "#0F1629",
                position: "relative",
                boxShadow: b.hi
                  ? "inset 0 0 0 1px rgba(165,180,252,.35)"
                  : "none",
              }}
            >
              {b.hi && (
                <div
                  className="mono"
                  style={{
                    position: "absolute",
                    top: 18,
                    right: 18,
                    fontSize: 9,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: "#A5B4FC",
                    color: "#0F1629",
                    letterSpacing: ".14em",
                    fontWeight: 600,
                  }}
                >
                  LE + BUUPP
                </div>
              )}
              <div
                className="mobile-icon-center"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: b.hi
                    ? "rgba(165,180,252,.22)"
                    : "rgba(165,180,252,.12)",
                  color: "#A5B4FC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Icon name={b.ic} size={18} />
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 22,
                  color: "var(--paper)",
                  marginBottom: 10,
                  letterSpacing: "-0.01em",
                }}
              >
                {b.t}
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  letterSpacing: "0.03em",
                  color: b.hi
                    ? "rgba(255,255,255,.78)"
                    : "rgba(255,255,255,.6)",
                }}
              >
                {b.d}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-2" data-reveal-group style={{ gap: 20, marginBottom: 64 }}>
          <div
            style={{
              padding: "clamp(24px, 3vw, 36px)",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,.1)",
              background: "rgba(255,255,255,.02)",
            }}
          >
            <div
              className="mono caps"
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,.4)",
                letterSpacing: ".15em",
                marginBottom: 16,
              }}
            >
              — Prospection classique
            </div>
            <div
              className="serif"
              style={{
                fontSize: 26,
                color: "rgba(255,255,255,.7)",
                marginBottom: 24,
              }}
            >
              Le cold call, l&apos;achat de fichier, la pub display
            </div>
            {classic.map((r, i) => (
              <div
                key={i}
                className="row between"
                style={{
                  padding: "12px 0",
                  borderTop: i ? "1px solid rgba(255,255,255,.08)" : "none",
                  fontSize: 14,
                  letterSpacing: "0.03em",
                }}
              >
                <span style={{ color: "rgba(255,255,255,.6)" }}>{r[1]}</span>
                <span
                  className="serif tnum"
                  style={{ fontSize: 20, color: "rgba(255,255,255,.85)" }}
                >
                  {r[0]}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              padding: "clamp(24px, 3vw, 36px)",
              borderRadius: 14,
              border: "1px solid #A5B4FC",
              background:
                "linear-gradient(180deg, rgba(165,180,252,.06), transparent)",
              position: "relative",
            }}
          >
            <div
              className="mono caps"
              style={{
                fontSize: 11,
                color: "#A5B4FC",
                letterSpacing: ".15em",
                marginBottom: 16,
              }}
            >
              — Avec BUUPP
            </div>
            <div
              className="serif"
              style={{ fontSize: 26, color: "var(--paper)", marginBottom: 24 }}
            >
              Le prospect a déjà <em style={{ color: "#A5B4FC" }}>accepté</em> à
              2 reprises
            </div>
            {bupp.map((r, i) => (
              <div
                key={i}
                className="row between"
                style={{
                  padding: "12px 0",
                  borderTop: i ? "1px solid rgba(165,180,252,.15)" : "none",
                  fontSize: 14,
                  letterSpacing: "0.01em",
                }}
              >
                <span style={{ color: "rgba(255,255,255,.7)" }}>{r[1]}</span>
                <span
                  className="serif tnum"
                  style={{ fontSize: 20, color: "#A5B4FC" }}
                >
                  {r[1] === "Taux d'acceptation moyen" ? (
                    <span
                      className="rocket-rise"
                      role="img"
                      aria-label="Taux d'acceptation en forte hausse"
                      style={{ fontSize: 22 }}
                    >
                      🚀
                    </span>
                  ) : (
                    r[0]
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div
            className="mono caps"
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,.4)",
              letterSpacing: ".18em",
              marginBottom: 24,
            }}
          >
            — Ils pourraient prospecter mieux{" "}
            <p className="inline text-[#4596EC] font-extrabold">avec BUUPP</p>
          </div>
          <div className="grid grid-4" data-reveal-group style={{ gap: 12 }}>
            {useCases.map((u, i) => (
              <div
                key={i}
                style={{
                  padding: 24,
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,.02)",
                }}
              >
                <div
                  className="serif"
                  style={{ fontSize: 22, color: "var(--paper)" }}
                >
                  {u[0]}
                </div>
                <div
                  className="muted"
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,.5)",
                    marginTop: 4,
                    marginBottom: 20,
                    letterSpacing: "0.06em",
                  }}
                >
                  {u[1]}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,.5)",
                    marginBottom: 6,
                    letterSpacing: "0.06em",
                  }}
                >
                  {u[2]}
                </div>
                <div
                  className="serif tnum"
                  style={{
                    fontSize: 18,
                    letterSpacing: "0.08em",
                    color: "var(--paper)",
                  }}
                >
                  {u[3]}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: "#A5B4FC",
                    marginTop: 4,
                  }}
                >
                  {u[4]}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 20,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              maxWidth: 760,
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,.45)",
                flexShrink: 0,
                marginTop: 1,
                display: "inline-flex",
              }}
              aria-hidden
            >
              <Icon name="info" size={14} />
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.6,
                color: "rgba(255,255,255,.45)",
                fontStyle: "italic",
              }}
            >
              Coûts donnés à titre indicatif : ils varient selon les paliers de
              données sollicités et la rémunération reversée aux prospects.
            </p>
          </div>
        </div>
      </div>
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      {roleModal}
    </section>
  );
}

// Illustration animée de la section À propos : trois nœuds (Protection des
// données · Sécurité · Consentement) reliés par un triangle où circule une
// impulsion néon, chacun entouré de boules en orbite. 100 % SVG/CSS, en
// boucle continue, respecte prefers-reduced-motion (cf. globals.css).
function Stats() {
  const stats: [string, string, string][] = [
    [
      "2",
      "Consentements requis",
      "CGU BUUPP + Sollicitation par le professionnel. Sans accord explicite des deux, aucune donnée n'est transmise.",
    ],
    [
      "5",
      "Paliers de données",
      "Des données d'identification aux centres d'intérêts. Chaque palier est cloisonné et monétisé séparément.",
    ],
    [
      "90%",
      "Taux d'acceptation",
      "L'assurance d'obtenir l'accord des prospects pour réaliser vos campagnes ciblées. À vous de jouer pour le reste.",
    ],
  ];
  return (
    <section
      className="section-md"
      style={{
        background: "var(--paper)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          className="grid grid-3 stats-grid"
          style={{
            gap: 0,
            letterSpacing: "0.04em",
            borderTop: "1px solid var(--line)",
          }}
        >
          {stats.map(([n, l, d], i) => (
            <div
              key={i}
              className={`stat-cell stat-cell-${i}`}
              style={{
                borderRight: i < 2 ? "1px solid var(--line)" : "none",
              }}
            >
              <div
                className="serif tnum"
                style={{
                  fontSize: "clamp(64px, 9vw, 120px)",
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                }}
              >
                {l === "Taux d'acceptation" ? (
                  <span
                    className="rocket-rise"
                    role="img"
                    aria-label="Taux d'acceptation en forte hausse"
                  >
                    🚀
                  </span>
                ) : (
                  n
                )}
              </div>
              <div
                className="serif italic muted"
                style={{ fontSize: "clamp(15px, 1.6vw, 18px)", marginTop: 4 }}
              >
                {l}
              </div>
              <div
                className="muted"
                style={{ fontSize: 13, marginTop: 12, maxWidth: 300 }}
              >
                {d}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  name,
  price,
  priceSuffix = "€ / campagne",
  features,
  cta,
  featured,
  onCta,
}: {
  name: string;
  price: string;
  priceSuffix?: string;
  features: string[];
  cta: string;
  featured?: boolean;
  onCta?: () => void;
}) {
  const cardStyle: CSSProperties = {
    padding: "clamp(24px, 4vw, 40px)",
    background: featured ? "var(--ink)" : "var(--paper)",
    color: featured ? "var(--paper)" : "var(--ink)",
    borderColor: featured ? "var(--ink)" : "var(--line)",
    position: "relative",
  };
  return (
    <div className="card" style={cardStyle}>
      {featured && (
        <div
          className="mono"
          style={{
            position: "absolute",
            top: 24,
            right: 24,
            fontSize: 10,
            padding: "4px 10px",
            borderRadius: 999,
            background: "#A5B4FC",
            color: "var(--ink)",
            letterSpacing: ".1em",
          }}
        >
          RECOMMANDÉ
        </div>
      )}
      <div
        className="serif"
        style={{
          fontSize: "clamp(28px, 3.2vw, 36px)",
          color: featured ? "var(--paper)" : "var(--ink)",
        }}
      >
        {name}
      </div>
      <div
        className="row"
        style={{ alignItems: "baseline", marginTop: 20, gap: 8 }}
      >
        <span
          className="serif tnum"
          style={{
            fontSize: "clamp(56px, 7vw, 80px)",
            lineHeight: 1,
            color: featured ? "var(--paper)" : "var(--ink)",
          }}
        >
          {price}
        </span>
        <span
          style={{
            fontSize: 16,
            color: featured ? "rgba(255,255,255,.6)" : "var(--ink-4)",
          }}
        >
          {priceSuffix}
        </span>
      </div>
      {/* Transparence prix — affichée AVANT la commission : le coût
          d'acquisition des prospects (rémunération versée à chaque mise en
          relation acceptée) est facturé à part. Bleu = couleur accent
          (var(--accent), comme « Sans engagement ») ; variante claire lisible
          sur la carte mise en avant (fond foncé). */}
      <div
        style={{
          marginTop: 8,
          fontSize: 13.5,
          fontWeight: 600,
          color: featured ? "#A5B4FC" : "var(--accent)",
        }}
      >
        hors coût d&apos;acquisition prospect
      </div>
      {/* La commission BUUPP s'ajoute au budget de campagne. */}
      <div
        style={{
          marginTop: 4,
          fontSize: 13.5,
          fontWeight: 600,
          color: featured ? "#4ADE80" : "#16A34A",
        }}
      >
        +10% commission buupp / budget de campagne
      </div>
      <div
        style={{
          marginTop: 32,
          borderTop: `1px solid ${featured ? "rgba(255,255,255,.1)" : "var(--line)"}`,
          paddingTop: 24,
        }}
      >
        {features.map((f, i) => (
          <div
            key={i}
            className="row center gap-3"
            style={{ padding: "8px 0", fontSize: 14 }}
          >
            <Icon name="check" size={14} stroke={1.75} />
            <span
              style={{
                color: featured ? "rgba(255,255,255,.86)" : "var(--ink-3)",
              }}
            >
              {f}
            </span>
          </div>
        ))}
      </div>
      <button
        className="btn btn-lg"
        onClick={onCta}
        style={{
          width: "100%",
          marginTop: 32,
          justifyContent: "center",
          background: featured ? "var(--paper)" : "var(--ink)",
          color: featured ? "var(--ink)" : "var(--paper)",
        }}
      >
        {cta} <Icon name="arrow" size={14} />
      </button>
    </div>
  );
}

function Pricing() {
  const router = useRouter();
  const { guard, modal: roleModal } = useRoleGuard();
  // Routage conditionnel des CTA tarifaires :
  //   - utilisateur anonyme → `/inscription/pro` pour créer un compte pro
  //   - utilisateur connecté → `guard("pro", "/pro")` :
  //       • si pro → /pro
  //       • si prospect → modal de conflit (déconnexion requise)
  // Le check anonymous se fait via /api/me/role pour éviter de pousser
  // un prospect déjà connecté vers /inscription/pro par erreur.
  const goToProOrSignup = async () => {
    try {
      const r = await fetch("/api/me/role", { cache: "no-store" });
      if (r.ok) {
        const j = (await r.json()) as {
          authenticated?: boolean;
          role?: "pro" | "prospect" | null;
        };
        if (j.authenticated) {
          guard("pro", "/pro");
          return;
        }
      }
    } catch {}
    router.push("/inscription/pro");
  };
  return (
    <section id="tarifs" className="section">
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 48, maxWidth: 640 }}>
          <div className="mono caps muted" style={{ marginBottom: 14 }}>
            — Tarifs professionnels
          </div>
          <h2 className="serif" style={{ letterSpacing: "0.06em" }}>
            Deux plans. <em>Sans engagement.</em>
          </h2>
          <p
            className="muted"
            style={{ fontSize: "clamp(15px, 1.6vw, 17px)", marginTop: 14 }}
          >
            Les prospects paient zéro — ils gagnent. Les professionnels paient à
            la qualité, pas au clic douteux.
          </p>
        </div>
        <div
          className="grid grid-2"
          data-reveal-group
          style={{ gap: 20, letterSpacing: "0.04em" }}
        >
          <PricingCard
            name="Starter"
            price="19"
            priceSuffix="€ / 2 campagnes"
            features={[
              "Jusqu'à 50 prospects par campagne",
              "2 campagnes par cycle",
              "Ciblage par paliers 1 à 3",
            ]}
            cta="Démarrer en Starter"
            onCta={goToProOrSignup}
          />
          <PricingCard
            name="Pro"
            price="59"
            priceSuffix="€ / 10 campagnes"
            featured
            features={[
              "Jusqu'à 500 prospects par campagne",
              "10 campagnes par cycle",
              "Tous les paliers 1 à 5",
              "Accès anticipé aux nouvelles fonctionnalités",
            ]}
            cta="Passer en Pro"
            onCta={goToProOrSignup}
          />
        </div>
      </div>
      {roleModal}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Section « App mobile » — réplique du design launch (public/prototype/app.html).
   4 thèmes pilotés par variables CSS via data-theme (cf. #app-mobile dans
   globals.css). Châssis iPhone réaliste conservé (Dynamic Island, rail titane,
   boutons, reflet). Écrans, décor (blobs, anneaux, pièces, étincelles, chips),
   sélecteur de thème et badges stores reproduits à l'identique.
   ───────────────────────────────────────────────────────────────────────── */
type AppTheme = { key: string; label: string; g1: string; g2: string };

const APP_THEMES: AppTheme[] = [
  { key: "buupp", label: "Buupp", g1: "#7d5cff", g2: "#4326c0" },
  { key: "sombre", label: "Sombre", g1: "#2a3354", g2: "#0d1424" },
  { key: "forest", label: "Forest", g1: "#3aa86c", g2: "#14532d" },
  { key: "fushia", label: "Fushia", g1: "#e9559b", g2: "#9c1f57" },
];

const F_SERIF = "var(--serif)";
const F_SANS = "var(--sans)";

function PhoneStatusBar() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 20px 2px", fontFamily: F_SANS }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)" }}>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 16h2M6 13h2M10 10h2M14 7h2" /></svg>
        <svg width="15" height="11" viewBox="0 0 24 18" fill="none"><path d="M12 3C8 3 5 5 3 7l9 10 9-10c-2-2-5-4-9-4z" stroke="var(--ink)" strokeWidth="2" /></svg>
        <div style={{ width: 18, height: 10, borderRadius: 3, border: "1.5px solid var(--ink)", position: "relative", opacity: 0.85 }}>
          <div style={{ position: "absolute", inset: "1.5px", width: "72%", borderRadius: 1, background: "var(--ink)" }} />
        </div>
      </div>
    </div>
  );
}

function PhoneRow({ label, sub, right, rightArrow, icon }: { label: string; sub: string; right?: string; rightArrow?: "check" | "arrow"; icon?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--card)", borderRadius: 12, border: "1px solid var(--line)", padding: rightArrow ? "10px 12px" : "9px 11px" }}>
      {!rightArrow && <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--accent-soft)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, lineHeight: 1 }}>{icon}</span>}
      <div style={{ flex: "1 1 0%", minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div style={{ fontSize: 9.5, color: "var(--sub)", marginTop: 1 }}>{sub}</div>
      </div>
      {right && <span style={{ fontFamily: F_SERIF, fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{right}</span>}
      {rightArrow === "check" && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4.5 4.5L19 7" /></svg>}
      {rightArrow === "arrow" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
    </div>
  );
}

/* Avatar — initiales « ML » sur fond teinté thème. */
function AvatarGirl({ fontSize }: { fontSize: number }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(150deg,var(--accent),var(--accent-deep))", color: "#fff", fontFamily: F_SERIF, fontWeight: 600, fontSize, letterSpacing: "0.5px" }}>ML</div>
  );
}

/* Couronne or scintillante du fondateur Proud (même esprit que le popup mobile). */
function FounderCrown({ size = 14 }: { size?: number }) {
  return (
    <span className="crown-spark" style={{ display: "inline-flex", position: "relative", lineHeight: 0, verticalAlign: "middle" }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="founderCrownGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFE9A8" />
            <stop offset="48%" stopColor="#F5C84B" />
            <stop offset="100%" stopColor="#D99A2B" />
          </linearGradient>
        </defs>
        <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z" fill="url(#founderCrownGold)" stroke="#B8791E" strokeWidth="1" strokeLinejoin="round" />
        <circle cx="12" cy="6.2" r="1.2" fill="#FFF3CC" stroke="#B8791E" strokeWidth=".6" />
      </svg>
      <span className="spk" style={{ position: "absolute", top: -3, right: -4, color: "#FFEEA8", fontSize: size * 0.6 }}>✦</span>
      <span className="spk2" style={{ position: "absolute", bottom: -3, left: -4, color: "#FFF6D0", fontSize: size * 0.45 }}>✦</span>
    </span>
  );
}

function ScreenHome() {
  return (
    <>
      <PhoneStatusBar />
      <div style={{ position: "relative", height: "calc(100% - 28px)", overflow: "hidden" }}>
        <div style={{ fontFamily: F_SANS, padding: "4px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--sub)" }}>Bonjour 👋</div>
              <div style={{ fontFamily: F_SERIF, fontSize: 21, fontWeight: 600, color: "var(--ink)", lineHeight: 1.05 }}>Marie</div>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", boxShadow: "0 2px 6px rgba(10,16,30,.18)", flexShrink: 0 }}><AvatarGirl fontSize={14} /></div>
          </div>
          <div style={{ position: "relative", overflow: "hidden", marginTop: 14, borderRadius: 18, padding: "15px 16px", background: "linear-gradient(145deg,var(--accent),var(--accent-deep))", boxShadow: "0 12px 24px var(--accent-shadow)" }}>
            <div style={{ position: "absolute", right: -14, top: -14, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.13)" }} />
            <div style={{ position: "relative", fontSize: 10.5, color: "rgba(255,255,255,0.82)" }}>Mon portefeuille (illustratif)</div>
            <div style={{ position: "relative", fontFamily: F_SERIF, fontSize: 30, fontWeight: 600, color: "#fff", lineHeight: 1, marginTop: 5 }}>127,50 €</div>
            <div style={{ position: "relative", fontSize: 10.5, color: "rgba(255,255,255,0.82)", marginTop: 7 }}>+12,40 € ce mois-ci</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 11 }}>
            <div style={{ background: "var(--card)", borderRadius: 14, padding: "11px 13px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 10, color: "var(--sub)" }}>Gains</div>
              <div style={{ fontFamily: F_SERIF, fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>34</div>
            </div>
            <div style={{ background: "var(--card)", borderRadius: 14, padding: "11px 13px", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 10, color: "var(--sub)" }}>Score</div>
              <div style={{ fontFamily: F_SERIF, fontSize: 20, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>82</div>
            </div>
          </div>
          <div style={{ fontFamily: F_SERIF, fontSize: 15, fontWeight: 600, color: "var(--ink)", marginTop: 15, marginBottom: 9 }}>Activité récente</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <PhoneRow icon="📍" label="Données local…" sub="Aujourd’hui" right="+2,00 €" />
            <PhoneRow icon="🤝" label="Parrainage · L…" sub="Hier" right="+5,00 €" />
            <PhoneRow icon="🌿" label="Style de vie" sub="2 mai" right="+3,50 €" />
          </div>
        </div>
      </div>
    </>
  );
}

function ScreenDeals() {
  return (
    <>
      <PhoneStatusBar />
      <div style={{ position: "relative", height: "calc(100% - 28px)", overflow: "hidden" }}>
        <div style={{ fontFamily: F_SANS, padding: "4px 16px 0" }}>
          <div style={{ fontFamily: F_SERIF, fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>Flash deals</div>
          <div style={{ marginTop: 12, borderRadius: 16, padding: "14px 15px", background: "var(--card)", border: "1.5px solid var(--accent)", boxShadow: "0 10px 22px var(--accent-shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: "var(--accent)", color: "#fff", fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, whiteSpace: "nowrap" }}>OFFRE ÉCLAIR</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
                19:58
              </span>
            </div>
            <div style={{ fontFamily: F_SERIF, fontSize: 15, fontWeight: 600, color: "var(--ink)", marginTop: 11, lineHeight: 1.15 }}>Test nouveau parfum</div>
            <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 3 }}>Révélez votre profil et gagnez</div>
            <div style={{ fontFamily: F_SERIF, fontSize: 25, fontWeight: 600, color: "var(--accent)", marginTop: 8 }}>+ 8,00 €</div>
          </div>
          <div style={{ fontFamily: F_SERIF, fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 15, marginBottom: 9 }}>Autres opportunités</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <PhoneRow icon="🥖" label="Boulangerie d’Or · Pro vérifié" sub="Palier 4" right="+5,00 €" />
            <PhoneRow icon="🍽️" label="Restaurant 1st · Pro vérifié" sub="Palier 5" right="+9,00 €" />
            <PhoneRow icon="🎭" label="Théâtre Duo · Pro vérifié" sub="Palier 2" right="+2,00 €" />
          </div>
        </div>
      </div>
    </>
  );
}

function ScreenProfile() {
  return (
    <>
      <PhoneStatusBar />
      <div style={{ position: "relative", height: "calc(100% - 28px)", overflow: "hidden" }}>
        <div style={{ fontFamily: F_SANS, padding: "8px 16px 0", textAlign: "center" }}>
          <div style={{ width: 62, height: 62, borderRadius: "50%", margin: "0 auto", overflow: "hidden", boxShadow: "0 8px 18px var(--accent-shadow)" }}><AvatarGirl fontSize={24} /></div>
          <div style={{ fontFamily: F_SERIF, fontSize: 18, fontWeight: 600, color: "var(--ink)", marginTop: 10 }}>Marie L</div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, padding: "3px 10px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
            FONDATEUR · PROUD
            <FounderCrown size={13} />
          </span>
          <div style={{ position: "relative", width: 88, height: 88, margin: "14px auto 0" }}>
            <svg width="88" height="88" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="44" cy="44" r="30" fill="none" stroke="var(--accent-soft)" strokeWidth="8" />
              <circle cx="44" cy="44" r="30" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray="188.5" strokeDashoffset="33.9" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: F_SERIF, fontSize: 24, fontWeight: 600, color: "var(--ink)", lineHeight: 1 }}>82</span>
              <span style={{ fontSize: 8, color: "var(--sub)", marginTop: 2 }}>Score de profil</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 16, textAlign: "left" }}>
            <PhoneRow label="Identification" sub="Palier 1" rightArrow="check" />
            <PhoneRow label="Localisation" sub="Palier 2" rightArrow="check" />
            <PhoneRow label="Patrimoine" sub="Palier 5" rightArrow="arrow" />
          </div>
        </div>
      </div>
    </>
  );
}

function AppPhone({ width, transform, z, delay, margin, children }: { width: string; transform: string; z: number; delay: number; margin: string; children: ReactNode }) {
  const sideBtn: CSSProperties = { position: "absolute", borderRadius: 3, background: "linear-gradient(90deg,#26262a,#54545a 55%,#1f1f23)", zIndex: 1 };
  return (
    <div style={{ width, aspectRatio: "9 / 19.5", position: "relative", flex: "0 0 auto", margin, transform, transformOrigin: "bottom center", zIndex: z }}>
      {/* couche de flottement : translateY animé, séparé de la rotation parent */}
      <div className="app-anim" style={{ position: "absolute", inset: 0, animation: `appFloatY ${6.5 + delay}s ease-in-out ${(delay * 0.7).toFixed(2)}s infinite` }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "clamp(34px,5.2vw,48px)", background: "linear-gradient(135deg,#46464a 0%,#1d1d20 24%,#5a5a5f 50%,#202024 76%,#43434a 100%)", boxShadow: "0 42px 72px -24px rgba(15,22,41,.58), 0 16px 32px rgba(15,22,41,.22), inset 0 0 0 1px rgba(255,255,255,.14)" }}>
        <div style={{ position: "absolute", inset: "2%", borderRadius: "clamp(30px,4.6vw,43px)", background: "#000" }}>
          <div style={{ position: "absolute", inset: "1.7%", borderRadius: "clamp(26px,4vw,38px)", overflow: "hidden", background: "var(--screen-bg)", transition: "background .4s" }}>
            {children}
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(125deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 26%, rgba(255,255,255,0) 74%, rgba(255,255,255,.06) 100%)" }} />
          </div>
          <div style={{ position: "absolute", top: "2.4%", left: "50%", transform: "translateX(-50%)", width: "30%", height: "3.3%", minHeight: 13, background: "#000", borderRadius: 999, zIndex: 6, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "4%" }}>
            <span style={{ width: "13%", maxWidth: 7, aspectRatio: "1", borderRadius: 999, background: "radial-gradient(circle at 35% 30%, #2b3550, #05060a 70%)" }} />
          </div>
        </div>
        <div style={{ ...sideBtn, left: "-1.4%", top: "17%", width: "1.8%", height: "4.5%" }} />
        <div style={{ ...sideBtn, left: "-1.6%", top: "27%", width: "2%", height: "8.5%" }} />
        <div style={{ ...sideBtn, left: "-1.6%", top: "38.5%", width: "2%", height: "8.5%" }} />
        <div style={{ ...sideBtn, right: "-1.6%", top: "31%", width: "2%", height: "12%", background: "linear-gradient(270deg,#26262a,#54545a 55%,#1f1f23)" }} />
      </div>
      </div>
    </div>
  );
}

function AppStore({ kind }: { kind: "apple" | "android" }) {
  const apple = kind === "apple";
  return (
    <div className="m-store">
      {apple ? (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3c0 1.5-1.2 3-2.7 3 0-1.5 1.3-3 2.7-3zM18 16.5c-.5 1.2-1.7 3.3-3 3.3-.9 0-1.2-.6-2.3-.6s-1.4.6-2.3.6c-1.4 0-2.7-2.3-3.2-3.5C5.4 13.5 6 9 9 9c1 0 1.8.6 2.5.6S13 9 14.2 9c1 0 2 .5 2.6 1.4-2.3 1.3-1.9 4.6 1.2 6.1z" fill="currentColor" stroke="none" /></svg>
      ) : (
        <svg width="22" height="24" viewBox="0 0 24 26" aria-hidden="true"><path d="M3 2l13 11L3 24z" fill="#34d399" /><path d="M3 2l13 11-3 3z" fill="#60a5fa" /><path d="M3 24l13-11-3-3z" fill="#fbbf24" /><path d="M16 13l5-3-5-3z" fill="#f87171" /></svg>
      )}
      <span className="m-store-txt"><small>Bientôt sur</small><strong>{apple ? "App Store" : "Google Play"}</strong></span>
    </div>
  );
}

function MobileAppSection() {
  const [theme, setTheme] = useState("buupp");
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 760);
    onR();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  const W = "clamp(190px,21vw,242px)";
  // Éventail : pivot bas (transform-origin: bottom center sur AppPhone), les
  // latéraux s'écartent vers le haut, bords inférieurs ~alignés, fort recouvrement.
  const phones = narrow
    ? [{ scr: <ScreenDeals />, transform: "none", z: 3, delay: 0, margin: "0" }]
    : [
        { scr: <ScreenHome />, transform: "rotate(-15deg)", z: 1, delay: 0.8, margin: "0 -72px 0 0" },
        { scr: <ScreenDeals />, transform: "translateY(-14px) scale(1.06)", z: 3, delay: 0, margin: "0" },
        { scr: <ScreenProfile />, transform: "rotate(15deg)", z: 1, delay: 1.4, margin: "0 0 0 -72px" },
      ];

  return (
    <section id="app-mobile" className="section" data-theme={theme}>
      <div className="m-decor" aria-hidden="true">
        <div className="m-blob m-blob-a app-anim" />
        <div className="m-blob m-blob-b app-anim" />
        <div className="m-blob m-blob-c app-anim" />
        <div className="m-ring m-ring-1" />
        <div className="m-ring m-ring-2" />
        <span className="m-coin m-coin-1 app-anim">B</span>
        <span className="m-coin m-coin-2 app-anim">B</span>
        <span className="m-spark m-spark-1 app-anim"><svg width="26" height="26" viewBox="0 0 24 24" fill="var(--decor)"><path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6L12 16.8 6.6 19.4l1.2-6L3.4 9.3l6-.7z" /></svg></span>
        <span className="m-spark m-spark-2 app-anim"><svg width="18" height="18" viewBox="0 0 24 24" fill="var(--decor)"><path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6L12 16.8 6.6 19.4l1.2-6L3.4 9.3l6-.7z" /></svg></span>
        <span className="m-spark m-spark-3 app-anim"><svg width="22" height="22" viewBox="0 0 24 24" fill="var(--accent)"><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z" /></svg></span>
        <span className="m-chip m-chip-1 app-anim"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l5.5-5.5 3.5 3.5L21 6" /><path d="M21 11V6h-5" /></svg> ROI</span>
        <span className="m-chip m-chip-2 app-anim"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="9" width="16" height="11" rx="1.5" /><path d="M4 13h16M12 9v11M12 9S10.5 4 8 5.5 9.5 9 12 9zM12 9s1.5-5 4-3.5S14.5 9 12 9z" /></svg> +5 €</span>
      </div>

      <div className="m-inner">
        <span className="m-badge"><span className="m-badge-dot" /> Au lancement officiel · iOS &amp; Android</span>
        <h2 className="m-headline">L’app BUUPP arrive <em>sur mobile.</em></h2>
        <p className="m-sub">Il y en aura pour tous les goûts et toutes les couleurs.</p>

        <div className="m-phones">
          {phones.map((p, i) => (
            <AppPhone key={i} width={W} transform={p.transform} z={p.z} delay={p.delay} margin={p.margin}>{p.scr}</AppPhone>
          ))}
        </div>

        <div className="m-themes" role="tablist" aria-label="Thèmes">
          {APP_THEMES.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={t.key === theme} className={`m-theme-btn${t.key === theme ? " on" : ""}`} onClick={() => setTheme(t.key)}>
              <span className="m-theme-dot" style={{ background: `linear-gradient(150deg, ${t.g1}, ${t.g2})` }}>
                <span className="m-theme-gloss" />
                <svg className="m-theme-glyph" width="17" height="17" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6L12 16.8 6.6 19.4l1.2-6L3.4 9.3l6-.7z" /></svg>
              </span>
              <span className="m-theme-label">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="m-stores">
          <AppStore kind="apple" />
          <AppStore kind="android" />
        </div>
        <p className="m-foot">Disponible au lancement officiel de BUUPP.</p>
      </div>
    </section>
  );
}

function FinalCTA() {
  const { guard, modal: roleModal } = useRoleGuard();
  return (
    <section
      className="section"
      style={{
        background: "var(--ivory-2)",
        borderTop: "1px solid var(--line)",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <h2 className="serif" style={{ letterSpacing: "0.06em" }}>
          Be <em>Used.</em> Paid. <em>Proud.</em>
        </h2>
        <p
          className="muted"
          style={{
            fontSize: "clamp(15px, 1.7vw, 18px)",
            maxWidth: 600,
            margin: "20px auto 0",
          }}
        >
          Le marketing qui vous rémunère, enfin. Sans spam, sans fuite, sans le
          sentiment d&apos;être le produit.
        </p>
        <div
          className="row center gap-3 wrap"
          style={{ justifyContent: "center", marginTop: 32 }}
        >
          <button
            className="btn btn-lg btn-primary btn-block-mobile"
            onClick={() => guard("prospect", "/prospect", "/inscription/prospect")}
          >
            Créer mon profil prospect
          </button>
          <button
            className="btn btn-lg btn-ghost btn-block-mobile"
            onClick={() => guard("pro", "/pro", "/inscription/pro")}
          >
            Ouvrir un compte pro
          </button>
        </div>
      </div>
      {roleModal}
    </section>
  );
}

function StickyPreinscription() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const threshold = window.innerWidth < 768 ? 280 : 600;
      setVisible(window.scrollY > threshold);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <button
      onClick={() => goWaitlist(router)}
      aria-label="Pré-inscription à la liste d'attente"
      className="sticky-preinscription"
      style={{
        position: "fixed",
        right: "max(22px, calc((100vw - 1280px) / 2 + 22px))",
        bottom: 24,
        zIndex: 95,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 22px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: "linear-gradient(135deg, #4596EC 0%, #6BA8F0 100%)",
        color: "#0F1629",
        fontFamily: "var(--sans)",
        fontWeight: 600,
        fontSize: 14,
        boxShadow:
          "0 18px 40px -10px rgba(69,150,236,.55), 0 6px 14px rgba(15,22,41,.18), inset 0 1px 0 rgba(255,255,255,.45)",
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translateY(0) scale(1)"
          : "translateY(20px) scale(.92)",
        pointerEvents: visible ? "auto" : "none",
        transition:
          "opacity .35s cubic-bezier(.22,1,.36,1), transform .35s cubic-bezier(.22,1,.36,1)",
      }}
    >
      <Icon name="sparkle" size={15} />
      Pré-inscription
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: "3px 8px",
          borderRadius: 999,
          background: "rgba(15,22,41,.22)",
          letterSpacing: ".02em",
        }}
      >
        +5€
      </span>
    </button>
  );
}

export default function HomeClient() {
  return (
    <div className="page" style={{ background: "var(--ivory)" }}>
      <Navbar />
      <Hero />
      <FlashDeal />
      <HowItWorks />
      <TiersTable />
      <DesirabiliteScene />
      <ProsSection />
      <Stats />
      <Pricing />
      <MobileAppSection />
      <FinalCTA />
      <VideoLearnSection />
      <Footer />
      <StickyPreinscription />
    </div>
  );
}
