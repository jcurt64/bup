"use client";

import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";

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
    range: "0,10 € – 0,50 €",
    low: 0.1,
    high: 0.5,
  },
  {
    n: 2,
    name: "Localisation",
    ex: "adresse, logement",
    range: "0,50 € – 1,00 €",
    low: 0.5,
    high: 1.0,
  },
  {
    n: 3,
    name: "Style de vie",
    ex: "habitudes, famille, véhicule",
    range: "1,00 € – 2,00 €",
    low: 1.0,
    high: 2.0,
  },
  {
    n: 4,
    name: "Données professionnelles",
    ex: "poste, revenus, statut",
    range: "2,00 € – 4,00 €",
    low: 2.0,
    high: 4.0,
  },
  {
    n: 5,
    name: "Patrimoine & projets",
    ex: "immobilier, épargne",
    range: "4,00 € – 8,00 €",
    low: 4.0,
    high: 8.0,
  },
];

type IconName =
  | "arrow"
  | "check"
  | "sparkle"
  | "bolt"
  | "target"
  | "wallet"
  | "trend"
  | "gauge";

const ICON_PATHS: Record<IconName, ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M20 6L9 17l-5-5" />,
  sparkle: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M16 13h2M3 10h18" />
    </>
  ),
  trend: <path d="M3 17l6-6 4 4 8-9M14 6h7v7" />,
  gauge: (
    <>
      <path d="M12 15a4 4 0 1 0-4-4" />
      <path d="M3 12a9 9 0 0 1 18 0" />
    </>
  ),
};

function Icon({
  name,
  size = 16,
  stroke = 1.5,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

function Logo({
  size = 50,
  color,
  onClick,
}: {
  size?: number;
  color?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="row center" style={{ color: color || "inherit" }}>
      <img
        src="/logo%20buupp.png"
        alt="BUPP"
        style={{ height: size, width: "auto", display: "block" }}
      />
    </div>
  );
  if (onClick) {
    return (
      <button
        onClick={onClick}
        aria-label="Retour à l'accueil"
        style={{
          padding: 0,
          background: "transparent",
          border: 0,
          cursor: "pointer",
          color: "inherit",
        }}
      >
        {content}
      </button>
    );
  }
  return content;
}

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
  { t: "inversée.", color: "#A5B4FC" },
  { t: "transparente.", color: "#FB923C" },
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

function Navbar() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const goAnchor = (id: string) => {
    setOpen(false);
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background:
            scrolled || open ? "rgba(247,244,236,.92)" : "var(--ivory)",
          backdropFilter: scrolled || open ? "blur(10px)" : "none",
          borderBottom:
            scrolled || open
              ? "1px solid var(--line)"
              : "1px solid transparent",
          transition: "background .2s, border-color .2s",
        }}
      >
        <div
          style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 20px" }}
          className="row between center"
        >
          <div className="row center" style={{ gap: 32 }}>
            <Logo
              size={50}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            />
            <nav className="row gap-6 nav-desktop" style={{ marginLeft: 8 }}>
              <a className="nav-link" href="#prospects">
                Prospect
              </a>
              <a className="nav-link" href="#pros">
                Professionnel
              </a>
              <a className="nav-link" href="#tarifs">
                Tarifs
              </a>
            </nav>
          </div>

          <div className="row center gap-3 nav-desktop">
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => router.push("/connexion")}
            >
              Se connecter
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => router.push("/connexion")}
            >
              Démarrer <Icon name="arrow" size={14} />
            </button>
          </div>

          <button
            className="hamburger"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            aria-controls="mobile-drawer"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="hamburger-bars" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>

      <div
        id="mobile-drawer"
        className="mobile-drawer"
        data-open={open}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        {/* Lien menu format telephone */}
        <div className="mobile-drawer-inner">
          <button className="drawer-link" onClick={() => goAnchor("prospects")}>
            Prospect
          </button>
          <button className="drawer-link" onClick={() => goAnchor("pros")}>
            Professionnel
          </button>
          <button className="drawer-link" onClick={() => goAnchor("tarifs")}>
            Tarifs
          </button>
          <div className="drawer-ctas">
            <button
              className="btn btn-lg btn-ghost"
              style={{ justifyContent: "center" }}
              onClick={() => go("/connexion")}
            >
              Se connecter
            </button>
            <button
              className="btn btn-lg btn-primary"
              style={{ justifyContent: "center" }}
              onClick={() => go("/connexion")}
            >
              Démarrer <Icon name="arrow" size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Hero() {
  const router = useRouter();
  return (
    <section
      className="hero-section"
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
          style={{ alignItems: "flex-end", marginBottom: 40, gap: 16 }}
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
            — France, avril 2026
          </div>
        </div>

        <h1 className="serif" style={{ color: "var(--paper)", maxWidth: 1100 }}>
          La publicité,
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
            BUUPP est la première plateforme qui rémunère les particuliers pour
            accepter d&apos;être contactés par les professionnels. Double
            consentement,{" "}
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
              className="btn btn-lg btn-block-mobile"
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
              className="btn btn-lg btn-block-mobile"
              onClick={() => router.push("/prospect")}
              style={{ background: "var(--paper)", color: "var(--ink)" }}
            >
              Je suis prospect <Icon name="arrow" size={16} />
            </button>
            <button
              className="btn btn-lg btn-ghost btn-block-mobile"
              onClick={() => router.push("/pro")}
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
          <div
            className="mono hero-live-label"
            style={{
              fontSize: 10,
              letterSpacing: ".18em",
              color: "rgba(22,163,74)",
              marginBottom: 14,
            }}
          >
            ● EN DIRECT — Mises en relation acceptées ces dernières heures
          </div>
          <div style={{ overflow: "hidden" }}>
            <div className="marquee">
              {[...Array(2)].flatMap((_, r) =>
                (
                  [
                    ["Kiné à Lyon 3e", "Marie L.", "4,20 €"],
                    ["Coach pro, Nantes", "Antoine R.", "6,80 €"],
                    ["Agence immo Paris 11", "Solène P.", "9,40 €"],
                    ["Artisan menuisier", "Karim B.", "3,10 €"],
                    ["PME SaaS B2B", "Julie T.", "7,50 €"],
                    ["Nutritionniste Lille", "Théo M.", "5,60 €"],
                  ] as const
                ).map((row, i) => (
                  <div
                    key={`${r}-${i}`}
                    className="row center gap-3"
                    style={{ fontSize: 13, color: "rgba(255,255,255,.7)" }}
                  >
                    <span style={{ color: "rgba(255,255,255,.4)" }}>◇</span>
                    <span>{row[0]}</span>
                    <span style={{ color: "rgba(255,255,255,.4)" }}>→</span>
                    <span>{row[1]}</span>
                    <span className="mono" style={{ color: "#A5B4FC" }}>
                      +{row[2]}
                    </span>
                  </div>
                )),
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FlashDeal() {
  const [left, setLeft] = useState(2 * 3600 - 1);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const h = String(Math.floor(left / 3600)).padStart(2, "0");
  const m = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  return (
    <section
      style={{
        background: "var(--paper)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        className="container row between center wrap flash-deal-row"
        style={{ padding: "12px 20px", gap: 12 }}
      >
        <div className="row center gap-3 wrap" style={{ flex: "1 1 280px" }}>
          <span
            className="badge"
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              fontSize: 15,
              borderColor: "var(--ink)",
            }}
          >
            <Icon name="bolt" size={14} /> Flash Deal
          </span>
          <span style={{ fontSize: 13, letterSpacing: "0.08em" }}>
            Gains <em>×3 </em> sur les paliers 3 à 5 pour toute demande acceptée
            dans l&apos;heure qui vient.
          </span>
        </div>
        <div
          className="row center gap-2 mono tnum"
          style={{ fontSize: 13, color: "var(--ink-3)" }}
        >
          <span>{h}</span>:<span>{m}</span>:<span>{s}</span>
          <span className="muted hide-sm" style={{ marginLeft: 6 }}>
            restantes
          </span>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Créez votre profil",
      body: "Renseignez uniquement ce que vous acceptez de partager, par paliers. Chaque palier validé augmente votre BUPP Score et vos gains potentiels.",
    },
    {
      n: "02",
      title: "Choisissez vos contacts",
      body: "Vous recevez des demandes ciblées et vérifiées. Acceptez ou refusez la sollicitation. Les données vous appartiennent.",
    },
    {
      n: "03",
      title: "Encaissez vos gains",
      body: "Chaque mise en relation acceptée crédite votre portefeuille en BUPP Coins. Retrait par IBAN, carte cadeau ou don associatif.",
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
              n&apos;est transmise avant que vous, puis le professionnel, ne
              confirmiez la mise en relation.
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
                  fontSize: 12,
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
              Afficher les gains Prospect vérifié 100%
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
                              {(t.low * 2).toFixed(2).replace(".", ",")} € –{" "}
                              {(t.high * 2).toFixed(2).replace(".", ",")} €
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
                Prospect vérifié 100% → gains doublés ×2
              </span>
            </div>
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--ink-4)" }}
            >
              Fourchette d&apos;estimation par budget de la campagne
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreSection() {
  const ranges: [string, string, string][] = [
    ["0–399", "Découverte", "#B91C1C"],
    ["400–699", "Solide", "#A16207"],
    ["700–899", "Recherché", "var(--accent)"],
    ["900–1000", "Prestige", "#166534"],
  ];
  const stats: [string, number][] = [
    ["Complétude des paliers", 80],
    ["Fraîcheur des données", 92],
    ["Taux d'acceptation", 66],
    ["Évaluations positives", 88],
  ];
  return (
    <section className="section">
      <div
        className="grid grid-2"
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          gap: 56,
          alignItems: "center",
        }}
      >
        <div>
          <div className="mono caps muted" style={{ marginBottom: 16 }}>
            — BUPP Score
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
            de vos données, votre taux d&apos;acceptation, et la qualité des
            évaluations reçues. Un score élevé attire des demandes plus
            exigeantes et mieux rémunérées.
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
                  <span className="muted">{l}</span>
                  <span className="mono tnum">{v}%</span>
                </div>
                <Progress value={v / 100} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProsSection() {
  const router = useRouter();
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
      ic: "trend",
      t: "ROI ×3 à ×5 en moyenne",
      d: "Taux d'acceptation moyen de 80% contre 1 à 3% sur les canaux froids. Vos équipes commerciales passent leur temps sur des échanges qui convertissent.",
    },
    {
      ic: "gauge",
      hi: true,
      t: "BUPP Score : qualité mesurée",
      d: "Chaque prospect est noté sur 900 points selon la qualité de son profil et son historique. Filtrez à partir du score minimum qui vous convient.",
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

  const classic: [string, string][] = [
    ["1–3%", "Taux d'acceptation"],
    ["< 10%", "Conformité RGPD mesurée"],
    ["120 €", "Coût moyen d'un lead qualifié"],
    ["⊘", "Aucune traçabilité du consentement"],
  ];

  const bupp: [string, string][] = [
    ["90%", "Taux d'acceptation moyen"],
    ["100%", "Double consentement horodaté"],
    ["5,40 €", "Coût moyen d'un contact qualifié"],
    ["✓", "Watermarking + piste d'audit complète"],
  ];

  return (
    <section
      id="pros"
      className="section"
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
              onClick={() => router.push("/pro")}
              style={{ background: "var(--paper)", color: "var(--ink)" }}
            >
              Ouvrir un compte pro <Icon name="arrow" size={14} />
            </button>
            <button
              className="btn btn-lg btn-ghost btn-block-mobile"
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
                  LE + BUPP
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

        <div className="grid grid-2" style={{ gap: 20, marginBottom: 64 }}>
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
              — Avec BUPP
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
                  {r[0]}
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
            <p className="inline text-[#4596EC] font-extrabold">avec BUPP</p>
          </div>
          <div className="grid grid-4" style={{ gap: 12 }}>
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
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const pillars = [
    {
      t: "Données pseudonymisées",
      d: "Vos données ne sont pas visibles intégralement. Les professionnels ne peuvent pas les extraire de la plateforme BUUPP.",
    },
    {
      t: "Consentement à usage unique",
      d: "Chaque accord donné est strictement limité à une seule sollicitation et à son émetteur. Les données ne peuvent être réutilisées, revendues, ni réactivées pour un autre usage.",
    },
    {
      t: "Anti-fraude multicouche",
      d: "Honeypots, détection de comptes dupliqués, empreinte appareil, scoring comportemental en temps réel.",
    },
    {
      t: "Watermarking des données",
      d: "Chaque fiche transmise est marquée individuellement — toute fuite est traçable jusqu'au professionnel émetteur.",
    },
  ];
  return (
    <section
      className="section"
      style={{ background: "var(--ink)", color: "var(--paper)" }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="row between wrap" style={{ marginBottom: 48, gap: 20 }}>
          <div>
            <div
              className="mono caps"
              style={{ color: "rgba(255,255,255,.4)", marginBottom: 14 }}
            >
              — Sécurité &amp; conformité
            </div>
            <h2
              className="serif"
              style={{
                color: "var(--paper)",
                maxWidth: 720,
                letterSpacing: "0.06em",
              }}
            >
              Une architecture pensée pour que{" "}
              <em style={{ color: "#A5B4FC", letterSpacing: "0.08em" }}>
                vos données
              </em>{" "}
              ne fuitent pas.
            </h2>
          </div>
        </div>
        <div
          className="grid grid-4"
          style={{ gap: 1, background: "rgba(255,255,255,.08)" }}
        >
          {pillars.map((p, i) => (
            <div
              key={i}
              style={{ background: "var(--ink)", padding: "24px 20px" }}
            >
              <div
                className="mono"
                style={{ fontSize: 10, color: "#A5B4FC", marginBottom: 14 }}
              >
                0{i + 1}
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 22,
                  marginBottom: 10,
                  letterSpacing: "0.01em",
                  color: "var(--paper)",
                }}
              >
                {p.t}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,.6)",
                  lineHeight: 1.6,
                  letterSpacing: "0.06em",
                }}
              >
                {p.d}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
                {n}
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
  features,
  cta,
  featured,
  onCta,
}: {
  name: string;
  price: string;
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
          € / campagne
        </span>
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
          style={{ gap: 20, letterSpacing: "0.04em" }}
        >
          <PricingCard
            name="Starter"
            price="29"
            features={[
              "50 contacts qualifiés par campagne",
              "Ciblage par paliers 1–3",
              "Dashboard & analytics essentiels",
              "Support email sous 48h",
            ]}
            cta="Démarrer en Starter"
            onCta={() => router.push("/connexion")}
          />
          <PricingCard
            name="Pro"
            price="99"
            featured
            features={[
              "Contacts illimités",
              "Tous les paliers 1–5",
              "CRM intégré + historique 12 mois",
              "Support dédié sous 4h",
            ]}
            cta="Passer en Pro"
            onCta={() => router.push("/connexion")}
          />
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  const router = useRouter();
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
          La publicité qui vous rémunère, enfin. Sans spam, sans fuite, sans le
          sentiment d&apos;être le produit.
        </p>
        <div
          className="row center gap-3 wrap"
          style={{ justifyContent: "center", marginTop: 32 }}
        >
          <button
            className="btn btn-lg btn-primary btn-block-mobile"
            onClick={() => router.push("/prospect")}
          >
            Créer mon profil prospect
          </button>
          <button
            className="btn btn-lg btn-ghost btn-block-mobile"
            onClick={() => router.push("/pro")}
          >
            Ouvrir un compte pro
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const columns: [string, string[]][] = [
    ["Plateforme", ["Prospects", "Professionnels", "Tarifs", "API"]],
    ["Ressources", ["Barème des paliers", "Documentation", "API", "Status"]],
    ["Légal", ["CGU", "CGV", "RGPD", "Contact DPO"]],
  ];
  return (
    <footer
      style={{
        padding: "56px 20px 96px",
        background: "var(--ink)",
        color: "rgba(255,255,255,.6)",
        fontSize: 13,
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          className="row between wrap"
          style={{ gap: 32, marginBottom: 40, alignItems: "flex-start" }}
        >
          <div style={{ flex: "1 1 240px", maxWidth: 320 }}>
            <Logo
              size={50}
              color="var(--paper)"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            />
            <div style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6 }}>
              BUUPPP est développée et exploitée par la société Majelink · 12
              Impasse des Étriers, 64140 Lons · RCS Pau 892 514 167.
            </div>
          </div>
          {columns.map(([h, items]) => (
            <div key={h} style={{ flex: "1 1 140px", minWidth: 120 }}>
              <div
                className="mono caps"
                style={{ color: "rgba(255,255,255,.4)", marginBottom: 12 }}
              >
                {h}
              </div>
              {items.map((it) => (
                <div key={it} style={{ padding: "4px 0" }}>
                  {it}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div
          className="row between wrap gap-2"
          style={{
            borderTop: "1px solid rgba(255,255,255,.1)",
            paddingTop: 20,
            fontSize: 12,
          }}
        >
          <div>© 2026 Majelink. Tous droits réservés.</div>
          <div className="row gap-4">
            <span>Français</span>
            <span>EUR €</span>
          </div>
        </div>
      </div>
    </footer>
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
        right: 22,
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

export default function Home() {
  return (
    <div className="page" style={{ background: "var(--ivory)" }}>
      <Navbar />
      <Hero />
      <FlashDeal />
      <HowItWorks />
      <TiersTable />
      <ScoreSection />
      <ProsSection />
      <SecuritySection />
      <Stats />
      <Pricing />
      <FinalCTA />
      <Footer />
      <StickyPreinscription />
    </div>
  );
}
