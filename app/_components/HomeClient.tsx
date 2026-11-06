"use client";

import Link from "next/link";

import {
  useState,
  useEffect,
  useRef,
  Fragment,
  type CSSProperties,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useRoleGuard, useCurrentRole } from "./RoleGuard";
import DemoModal from "./DemoModal";
import { Icon, Navbar, Footer, type IconName } from "./SiteChrome";
import { ACCESS_FROZEN_TOOLTIP } from "@/lib/app-config/access-ui";

type Router = ReturnType<typeof useRouter>;

function goWaitlist(router: Router) {
  try {
    sessionStorage.setItem("bupp:waitlist-ok", "1");
  } catch {}
  router.push("/liste-attente");
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

function Hero({
  accessOpen,
  waitlistOpen,
  studiesOpen = false,
}: {
  accessOpen: boolean;
  waitlistOpen: boolean;
  studiesOpen?: boolean;
}) {
  const router = useRouter();
  const { guard, modal: roleModal } = useRoleGuard();
  const [heroPeriod, setHeroPeriod] = useState(currentPeriodFr);
  // Carte « Nouveau » (≥ 1100 px) : centrée verticalement entre la ligne
  // « Be used · Paid & Proud » et les boutons « Je suis prospect / pro ».
  // Les deux repères dépendent de la largeur (titre et texte qui passent à
  // la ligne), d'où la mesure en direct, recalculée au redimensionnement.
  const heroTopRowRef = useRef<HTMLDivElement>(null);
  const heroHeadlineRef = useRef<HTMLDivElement>(null);
  const heroButtonsRef = useRef<HTMLDivElement>(null);
  const [newCardPos, setNewCardPos] = useState<{ top: number; space: number } | null>(null);
  useEffect(() => {
    if (!studiesOpen) return;
    const measure = () => {
      const row = heroTopRowRef.current?.getBoundingClientRect();
      const head = heroHeadlineRef.current?.getBoundingClientRect();
      // Haut réel des boutons : le conteneur `.hero-buttons` s'étire sur la
      // hauteur du texte voisin (boutons alignés en bas), on mesure donc ses
      // enfants visibles, pas le conteneur.
      const kids = Array.from(heroButtonsRef.current?.children ?? [])
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height > 0);
      if (!row || !head || !kids.length) return;
      const btnTop = Math.min(...kids.map((r) => r.top));
      setNewCardPos({ top: (row.bottom + btnTop) / 2 - head.top, space: btnTop - row.bottom });
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of [heroTopRowRef.current, heroHeadlineRef.current, heroButtonsRef.current]) if (el) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [studiesOpen]);
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
          ref={heroTopRowRef}
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

        <div className="hero-headline" ref={heroHeadlineRef}>
          <h1 className="serif" style={{ color: "var(--paper)", maxWidth: 1100 }}>
            Le marketing
            <br />
            <RotatingHeadlineWord />
          </h1>
          {/* Lancement du module Tests & Études : pastille « Nouveau »
              cliquable (affichée seulement quand le module est activé). */}
          {studiesOpen && (
            <div
              className="hero-new-slot"
              style={newCardPos ? ({ "--hero-new-top": `${newCardPos.top}px`, "--hero-new-space": `${newCardPos.space}px` } as CSSProperties) : undefined}
            >
              <Link href="/tests-etudes" className="hero-new-card" aria-label="Nouveau : Tests & Études, donnez votre avis et soyez rémunéré">
                <span className="hero-new-tag">
                  <span className="hero-new-dot" aria-hidden />
                  Nouveau
                </span>
                <span className="hero-new-title">Tests &amp; Études</span>
                <span className="hero-new-sub">Donnez votre avis,<br />soyez rémunéré.</span>
                <span className="hero-new-cta">
                  J&apos;en profite <Icon name="arrow" size={14} />
                </span>
              </Link>
            </div>
          )}
        </div>

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
            ref={heroButtonsRef}
            className="hero-buttons"
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            {/* La pré-inscription disparaît à l'expiration de la liste
                d'attente (cf. getWaitlistOpen) : une fois les vrais comptes
                ouverts, il ne reste que « Je suis prospect / pro ». */}
            {waitlistOpen && (
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
            )}
            {accessOpen ? (
              <>
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
              </>
            ) : (
              <>
                <span
                  className="frozen-cta frozen-cta-hero"
                  data-tip={ACCESS_FROZEN_TOOLTIP}
                >
                  <button
                    className="btn btn-lg btn-block-mobile hero-cta hero-cta-prospect"
                    disabled
                    style={{ background: "var(--paper)", color: "var(--ink)" }}
                  >
                    Je suis prospect <Icon name="arrow" size={16} />
                  </button>
                </span>
                <span
                  className="frozen-cta frozen-cta-hero"
                  data-tip={ACCESS_FROZEN_TOOLTIP}
                >
                  <button
                    className="btn btn-lg btn-ghost btn-block-mobile hero-cta hero-cta-pro"
                    disabled
                    style={{
                      color: "var(--paper)",
                      borderColor: "rgba(255,255,255,.28)",
                    }}
                  >
                    Je suis professionnel
                  </button>
                </span>
              </>
            )}
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

// ─── Rate-limit client (pré-check UX des décisions) ───────────────
// Aligné sur le rate-limit serveur (/api/prospect/relations/[id]/decision) :
// 1 décision toutes les 5 min PAR SOLLICITATION. Sert de pré-check côté
// UI : évite un aller-retour réseau et affiche un countdown.
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



function FlashDeal() {
  const router = useRouter();
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
  // Uniquement de vraies campagnes flash : sans campagne active, le
  // bandeau ne s'affiche pas du tout (aucun repli fictif).
  const liveDeals = (deals ?? []).filter(
    (d) => new Date(d.endsAt).getTime() - now > 0,
  );
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
  const { signOut } = useClerk();
  const [submitting, setSubmitting] = useState<"accept" | "refuse" | null>(
    null,
  );
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Popup d'information (ex. 409 `already_accepted_pro` : campagne réservée
  // aux nouveaux contacts du pro). Message serveur affiché tel quel.
  const [decisionNotice, setDecisionNotice] = useState<string | null>(null);
  // Consentement préalable spécifique au canal TÉLÉPHONE (réforme française
  // du démarchage téléphonique = opt-in) — même étape que l'onglet « Mises
  // en relation » du dashboard (cf. PhoneConsentModal dans Prospect.jsx).
  // Mémorise l'acceptation à finaliser une fois la popup confirmée :
  //   - "decide"       : acceptation d'une sollicitation en attente ;
  //   - "afterRefused" : acceptation finale après un refus (undo + accept).
  const [phoneConsentFor, setPhoneConsentFor] = useState<
    "decide" | "afterRefused" | null
  >(null);

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

  // Erreur de décision → popup dédiée pour `already_accepted_pro`, sinon
  // message inline habituel.
  const reportDecisionError = (e: unknown) => {
    const code = e instanceof Error ? e.message : "";
    if (code === "already_accepted_pro") {
      setDecisionNotice(
        extractServerMessage(e) ??
          "Vous avez déjà accepté une campagne de ce professionnel : cette offre ne vous est pas destinée.",
      );
      return;
    }
    setError(friendlyDecisionError(code, extractServerMessage(e)));
  };

  const decide = async (
    action: "accept" | "refuse",
    opts?: { phoneConsent?: boolean },
  ) => {
    // Pré-check du rate-limit serveur : 1 décision / 5 min. Évite un
    // aller-retour réseau et affiche directement le countdown.
    const left = decisionCooldownLeftMs(deal.id);
    if (left > 0) {
      setError(buildCooldownMessage(left));
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
          // phoneConsent: true — le prospect a confirmé la popup de
          // consentement au canal téléphonique (tracé côté serveur).
          body: JSON.stringify(
            action === "accept"
              ? { action, phoneConsent: opts?.phoneConsent === true }
              : { action },
          ),
        },
      );
      if (!r.ok) await throwApiError(r);
      setLastDecisionAtFor(deal.id, Date.now());
      await onAfterDecision();
    } catch (e) {
      reportDecisionError(e);
    } finally {
      setSubmitting(null);
    }
  };

  // Bascule accepted → refused tant que la campagne tourne encore.
  // Côté API, l'endpoint /decision accepte directement `refuse` depuis
  // un statut accepted (RPC refund_relation_tx).
  const refuseAfterAccepted = async () => {
    const left = decisionCooldownLeftMs(deal.id);
    if (left > 0) {
      setError(buildCooldownMessage(left));
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
      reportDecisionError(e);
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
          // Acceptation finale : le consentement téléphone a été donné
          // via la popup juste avant (cf. phoneConsentFor).
          body: JSON.stringify({ action: "accept", phoneConsent: true }),
        },
      );
      if (!acc.ok) await throwApiError(acc);
      setLastDecisionAtFor(deal.id, Date.now());
      await onAfterDecision();
    } catch (e) {
      reportDecisionError(e);
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
                onClick={() => setPhoneConsentFor("decide")}
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
              onClick={() => setPhoneConsentFor("afterRefused")}
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
      {phoneConsentFor && (
        <PhoneConsentDialog
          onAccept={() => {
            const which = phoneConsentFor;
            setPhoneConsentFor(null);
            if (which === "afterRefused") void acceptAfterRefused();
            else void decide("accept", { phoneConsent: true });
          }}
          onRefuse={() => setPhoneConsentFor(null)}
        />
      )}
      {decisionNotice && (
        <DecisionNoticeDialog
          message={decisionNotice}
          onClose={() => setDecisionNotice(null)}
        />
      )}
    </div>
  );
}

// Popup d'information superposée à la modale flash deal après un refus
// d'acceptation côté serveur (ex. `already_accepted_pro`). Même habillage
// que PhoneConsentDialog ; les clics ne remontent pas jusqu'au fond.
function DecisionNoticeDialog({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Offre non disponible"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,22,41,.55)",
        zIndex: 1001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--paper)",
          borderRadius: 14,
          padding: "clamp(18px, 4vw, 24px)",
          boxShadow:
            "0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)",
        }}
      >
        <div
          className="serif"
          style={{ fontSize: 20, marginBottom: 14, color: "var(--ink)" }}
        >
          Offre non disponible
        </div>
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            marginBottom: 18,
            background: "color-mix(in oklab, var(--accent) 8%, var(--paper))",
            border:
              "1.5px solid color-mix(in oklab, var(--accent) 40%, var(--line))",
            color: "var(--ink-2)",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              minWidth: 36,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="info" size={16} stroke={2} />
          </div>
          <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.6 }}>
            {message}
          </div>
        </div>
        <div className="row gap-2" style={{ justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            className="btn btn-sm"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            J&apos;ai compris
          </button>
        </div>
      </div>
    </div>
  );
}

// Popup de consentement préalable au canal TÉLÉPHONE, affichée à
// l'acceptation d'un flash deal depuis la page d'accueil. Réplique fidèle
// (texte + boutons) de PhoneConsentModal dans Prospect.jsx : « OK,
// j'accepte » finalise l'acceptation ; « Non, je refuse » l'annule.
// Superposée à la modale flash deal : les clics ne doivent pas remonter
// jusqu'au fond de celle-ci (qui la fermerait).
function PhoneConsentDialog({
  onAccept,
  onRefuse,
}: {
  onAccept: () => void;
  onRefuse: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onRefuse();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Contact par téléphone"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,22,41,.55)",
        zIndex: 1001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--paper)",
          borderRadius: 14,
          padding: "clamp(18px, 4vw, 24px)",
          boxShadow:
            "0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)",
        }}
      >
        <div
          className="serif"
          style={{ fontSize: 20, marginBottom: 14, color: "var(--ink)" }}
        >
          Contact par téléphone
        </div>
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            marginBottom: 18,
            background: "color-mix(in oklab, var(--accent) 8%, var(--paper))",
            border:
              "1.5px solid color-mix(in oklab, var(--accent) 40%, var(--line))",
            color: "var(--ink-2)",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              minWidth: 36,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="phone" size={16} stroke={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              En acceptant cette sollicitation
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              vous êtes susceptible d&apos;être{" "}
              <strong>contacté(e) par téléphone</strong> par ce professionnel,
              en plus des autres canaux. En cliquant sur « OK, j&apos;accepte »,
              vous donnez votre{" "}
              <strong>
                consentement préalable et spécifique au démarchage
                téléphonique
              </strong>{" "}
              pour cette mise en relation, conformément à la réglementation.
              Vous pourrez le retirer à tout moment.
            </div>
          </div>
        </div>
        <div
          className="row gap-2"
          style={{ justifyContent: "flex-end", flexWrap: "wrap" }}
        >
          <button onClick={onRefuse} className="btn btn-ghost btn-sm">
            Non, je refuse
          </button>
          <button
            onClick={onAccept}
            className="btn btn-sm"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            <Icon name="check" size={12} /> OK, j&apos;accepte
          </button>
        </div>
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
      title: "Choisissez qui vous contacte",
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
    ["à partir de 1 €", "Coût moyen d'un prospect"],
    ["✓", "Watermarking + piste d'audit complète"],
  ];

  return (
    <section
      id="pros"
      className="section motif-dots"
      data-nav-theme="dark"
      style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
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

        <div className="grid grid-2" data-reveal-group style={{ gap: 20 }}>
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

      </div>
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      {roleModal}
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
    backgroundColor: featured ? "var(--ink)" : "var(--paper)",
    color: featured ? "var(--paper)" : "var(--ink)",
    borderColor: featured ? "var(--ink)" : "var(--line)",
    position: "relative",
  };
  return (
    <div className={featured ? "card motif-grid" : "card"} style={cardStyle}>
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
      {/* Commission BUUPP par acceptation (10 %, plancher 0,30 €). */}
      <div
        style={{
          marginTop: 4,
          fontSize: 13.5,
          fontWeight: 600,
          color: featured ? "#4ADE80" : "#16A34A",
        }}
      >
        + commission BUUPP : 10 % par acceptation (min. 0,30 €)
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

/* Exemples chiffrés de la commission BUUPP (10 %, plancher 0,30 €). Miroir
   de lib/pricing/commission.ts. */
const COMMISSION_EXAMPLES: Array<[string, string, string, string]> = [
  ["1,00 €", "0,10 €", "0,30 € (plancher)", "1,30 €"],
  ["2,00 €", "0,20 €", "0,30 € (plancher)", "2,30 €"],
  ["3,00 €", "0,30 €", "0,30 €", "3,30 €"],
  ["5,00 €", "0,50 €", "0,50 €", "5,50 €"],
  ["10,00 €", "1,00 €", "1,00 €", "11,00 €"],
];

function CommissionExamplesCard() {
  const cell: CSSProperties = { padding: "10px 8px", fontSize: 14 };
  return (
    <div className="card" style={{ padding: "clamp(24px, 4vw, 40px)" }}>
      <div
        className="serif"
        style={{ fontSize: "clamp(24px, 2.6vw, 30px)", color: "var(--ink)" }}
      >
        Combien coûte une acceptation&nbsp;?
      </div>
      <p className="muted" style={{ fontSize: 14, marginTop: 10, lineHeight: 1.55 }}>
        On calcule 10 % de la rémunération du prospect et on retient le plus
        élevé entre ce montant et 0,30 €.
      </p>
      <div style={{ overflowX: "auto", marginTop: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr className="mono caps muted" style={{ fontSize: 10, textAlign: "left" }}>
              <th style={cell}>Prospect</th>
              <th style={cell}>10 %</th>
              <th style={cell}>Commission</th>
              <th style={{ ...cell, textAlign: "right" }}>Vous payez</th>
            </tr>
          </thead>
          <tbody>
            {COMMISSION_EXAMPLES.map(([reward, pct, com, total]) => (
              <tr key={reward} style={{ borderTop: "1px solid var(--line)" }}>
                <td className="tnum" style={cell}>{reward}</td>
                <td className="tnum muted" style={cell}>{pct}</td>
                <td className="tnum" style={{ ...cell, color: "#16A34A", fontWeight: 600 }}>{com}</td>
                <td className="tnum" style={{ ...cell, textAlign: "right", fontWeight: 600 }}>{total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
            Une formule. <em>Sans abonnement.</em>
          </h2>
          <p
            className="muted"
            style={{ fontSize: "clamp(15px, 1.6vw, 17px)", marginTop: 14 }}
          >
            Les prospects paient zéro — ils gagnent. Les professionnels ne
            paient que les acceptations : la rémunération du prospect, plus une
            commission BUUPP de 10 %, avec un minimum de 0,30 €.
          </p>
        </div>
        <div
          className="grid grid-2"
          data-reveal-group
          style={{ gap: 20, letterSpacing: "0.04em" }}
        >
          <PricingCard
            name="Formule unique"
            price="0"
            priceSuffix="€ d'abonnement"
            featured
            features={[
              "Campagnes illimitées",
              "Jusqu'à 500 prospects par campagne",
              "Tous les paliers de données 1 à 5",
              "Vous ne payez que les acceptations",
            ]}
            cta="Lancer ma première campagne"
            onCta={goToProOrSignup}
          />
          <CommissionExamplesCard />
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

/* Vraies captures de l'app mobile (iOS, compte fictif « Camille », 32 € au
   portefeuille), une série par thème de l'app : public/app-screens/<thème>/
   (buupp = clair, sombre, forest, fushia), réduites à 720 px. Les boutons
   de thème de la section basculent les écrans. Originaux :
   ~/Desktop/buupp-captures/site-4-themes. */
function AppScreenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 760px) 60vw, 260px"
      style={{ objectFit: "cover", objectPosition: "top center" }}
    />
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

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.buupp.app";

function AppStore({ kind }: { kind: "apple" | "android" }) {
  const apple = kind === "apple";
  const Tag = apple ? "div" : "a";
  return (
    <Tag className="m-store" {...(apple ? {} : { href: PLAY_STORE_URL, target: "_blank", rel: "noopener noreferrer" })}>
      {apple ? (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3c0 1.5-1.2 3-2.7 3 0-1.5 1.3-3 2.7-3zM18 16.5c-.5 1.2-1.7 3.3-3 3.3-.9 0-1.2-.6-2.3-.6s-1.4.6-2.3.6c-1.4 0-2.7-2.3-3.2-3.5C5.4 13.5 6 9 9 9c1 0 1.8.6 2.5.6S13 9 14.2 9c1 0 2 .5 2.6 1.4-2.3 1.3-1.9 4.6 1.2 6.1z" fill="currentColor" stroke="none" /></svg>
      ) : (
        <svg width="22" height="24" viewBox="0 0 24 26" aria-hidden="true"><path d="M3 2l13 11L3 24z" fill="#34d399" /><path d="M3 2l13 11-3 3z" fill="#60a5fa" /><path d="M3 24l13-11-3-3z" fill="#fbbf24" /><path d="M16 13l5-3-5-3z" fill="#f87171" /></svg>
      )}
      <span className="m-store-txt"><small>{apple ? "Bientôt sur" : "Disponible sur"}</small><strong>{apple ? "App Store" : "Google Play"}</strong></span>
    </Tag>
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
    ? [{ scr: <AppScreenshot src={`/app-screens/${theme}/flash-deals.jpg`} alt="Écran Flash deals de l’app BUUPP" />, transform: "none", z: 3, delay: 0, margin: "0" }]
    : [
        { scr: <AppScreenshot src={`/app-screens/${theme}/accueil.jpg`} alt="Écran d’accueil de l’app BUUPP : taux de fiabilité et portefeuille" />, transform: "rotate(-15deg)", z: 1, delay: 0.8, margin: "0 -72px 0 0" },
        { scr: <AppScreenshot src={`/app-screens/${theme}/flash-deals.jpg`} alt="Écran Flash deals de l’app BUUPP" />, transform: "translateY(-14px) scale(1.06)", z: 3, delay: 0, margin: "0" },
        { scr: <AppScreenshot src={`/app-screens/${theme}/mises-en-relation.jpg`} alt="Écran des mises en relation de l’app BUUPP" />, transform: "rotate(15deg)", z: 1, delay: 1.4, margin: "0 0 0 -72px" },
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
        <span className="m-badge"><span className="m-badge-dot" /> Disponible sur Android · bientôt sur iOS</span>
        <h2 className="m-headline">L’app BUUPP <em>sur mobile.</em></h2>
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
        <p className="m-foot">Disponible dès maintenant sur Google Play · bientôt sur l’App Store.</p>
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

/**
 * `accessOpen` reflète `app_config.access_buttons_enabled` : à false, les
 * entrées vers l'inscription et la connexion sont gelées (header + CTA du
 * hero) pendant la période de pré-inscription.
 *
 * `waitlistOpen` reflète `app_config.waitlist_open`, refermé d'office quand
 * `launch_at` est atteinte : à false, les deux entrées vers la
 * pré-inscription (CTA du hero et pastille flottante « Pré-inscription »)
 * disparaissent. Les deux bascules sont inverses l'une de l'autre au
 * lancement. Cf. lib/app-config/access.ts.
 */
export default function HomeClient({
  accessOpen = true,
  waitlistOpen = true,
  studiesOpen = false,
}: {
  accessOpen?: boolean;
  waitlistOpen?: boolean;
  studiesOpen?: boolean;
}) {
  return (
    <div className="page" style={{ background: "var(--ivory)" }}>
      <Navbar accessOpen={accessOpen} />
      <Hero accessOpen={accessOpen} waitlistOpen={waitlistOpen} studiesOpen={studiesOpen} />
      <FlashDeal />
      <HowItWorks />
      <ProsSection />
      <Pricing />
      <MobileAppSection />
      <FinalCTA />
      <Footer studiesOpen={studiesOpen} />
      {waitlistOpen && <StickyPreinscription />}
    </div>
  );
}
