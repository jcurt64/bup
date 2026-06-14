import type { Metadata } from "next";
import Link from "next/link";
import { Navbar, Footer, Icon, type IconName } from "../_components/SiteChrome";
import PrivacyByDesignTable from "../_components/PrivacyByDesignTable";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "BUUPP est imaginée par un juriste spécialisé en protection des données : confidentialité par conception, minimisation et pseudonymisation au cœur du produit.",
  alternates: { canonical: "/about" },
};

// Eyebrow réutilisé en tête de chaque section, pour un enchaînement cohérent.
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono caps"
      style={{
        fontSize: 11,
        letterSpacing: ".18em",
        color: "var(--accent)",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

const PRINCIPLES: { icon: IconName; t: string; d: string }[] = [
  {
    icon: "shield",
    t: "Privacy by Design",
    d: "La protection des données est intégrée dès la conception de chaque fonctionnalité — jamais ajoutée après coup. Double consentement, finalités explicites et bases légales documentées forment le socle du produit.",
  },
  {
    icon: "target",
    t: "Minimisation",
    d: "BUUPP ne collecte et ne transmet que les données strictement nécessaires à la finalité choisie par le professionnel. Chaque palier est cloisonné et monétisé séparément : rien de superflu ne circule.",
  },
  {
    icon: "lock",
    t: "Pseudonymisation",
    d: "Les données ne parviennent au professionnel que pseudonymisées — masquées, généralisées ou catégorisées. L'identité réelle reste réversible par buupp seul, et chaque révélation est journalisée conformément au RGPD.",
  },
];

const SECURITY: { t: string; d: string }[] = [
  {
    t: "Données pseudonymisées",
    d: "Vos données ne sont pas visibles intégralement. Les professionnels ne peuvent pas les extraire de la plateforme BUUPP.",
  },
  {
    t: "Consentement à usage unique",
    d: "Chaque accord donné est strictement limité à une seule sollicitation. Les données ne peuvent être revendues ni réutilisées pour un autre usage.",
  },
  {
    t: "Anti-fraude multicouche",
    d: "Contraintes d'unicité IBAN/téléphone/rôle, honeypots sur formulaires publics, journal d'audit verrouillé des révélations.",
  },
  {
    t: "Watermarking cryptographique",
    d: "L'email du prospect est révélé sous forme d'alias unique routé via Cloudflare — toute fuite remonte instantanément au professionnel émetteur.",
  },
];

export default function AboutPage() {
  return (
    <div className="page" style={{ background: "var(--ivory)" }}>
      <Navbar />

      {/* 1 · À propos de BUUPP — introduction pleine largeur */}
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
        {/* Quadrillage en fond, identique au hero de la page d'accueil */}
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
        {/* Halo orange en haut à gauche */}
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
        {/* Halo indigo en haut à droite */}
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
          <h1
            className="serif"
            style={{
              color: "var(--paper)",
              maxWidth: 1100,
              fontSize: "clamp(34px, 5vw, 72px)",
            }}
          >
            Une équipe obsédée par
            <br />
            la protection de <em>vos données</em>.
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
            <p
              className="hero-lede serif"
              style={{
                flex: "1 1 420px",
                maxWidth: 640,
                fontSize: "clamp(15px, 1.6vw, 19px)",
                lineHeight: 1.75,
                letterSpacing: "0.04em",
                color: "rgba(255,255,255,.78)",
              }}
            >
              BUUPP a été imaginée et créée par un juriste spécialisé dans la
              protection des données personnelles, fort de plus de dix ans
              d&apos;expérience au sein des grandes compagnies financières
              françaises. Toute l&apos;architecture de l&apos;application repose sur
              trois exigences&nbsp;: la{" "}
              <strong
                className="about-pulse-word"
                style={{ color: "#A5B4FC", fontWeight: 600, animationDelay: "0s" }}
              >
                protection
              </strong>{" "}
              de vos données, leur{" "}
              <strong
                className="about-pulse-word"
                style={{ color: "#FB923C", fontWeight: 600, animationDelay: "1s" }}
              >
                sécurité
              </strong>
              , et le{" "}
              <strong
                className="about-pulse-word"
                style={{ color: "#34D399", fontWeight: 600, animationDelay: "2s" }}
              >
                consentement
              </strong>{" "}
              systématique des prospects. Chez nous, l&apos;expertise RGPD
              n&apos;est pas un argument marketing —{" "}
              <strong
                style={{
                  color: "#fff",
                  fontWeight: 600,
                  background:
                    "linear-gradient(100deg, rgba(124,92,255,.55), rgba(99,102,241,.4))",
                  padding: "1px 8px",
                  borderRadius: 6,
                  boxShadow: "0 0 0 1px rgba(165,180,252,.25) inset",
                  WebkitBoxDecorationBreak: "clone",
                  boxDecorationBreak: "clone",
                }}
              >
                c&apos;est la fondation sur laquelle tout BUUPP est construit.
              </strong>
            </p>
            <div
              className="hero-buttons"
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <Link
                href="/rgpd"
                className="btn btn-lg btn-block-mobile"
                style={{ background: "var(--paper)", color: "var(--ink)" }}
              >
                Notre politique RGPD <Icon name="arrow" size={16} />
              </Link>
              <Link
                href="/contact-dpo"
                className="btn btn-lg btn-ghost btn-block-mobile"
                style={{
                  color: "var(--paper)",
                  borderColor: "rgba(255,255,255,.28)",
                }}
              >
                Contacter notre spécialiste RGPD
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2 · Confidentialité par conception — illustration agrandie.
          Fond en var(--ivory) IDENTIQUE au fond de l'iframe (ano.html utilise
          html,body{background:var(--ivory)}) pour que l'image se fonde sans
          rectangle visible. */}
      <section className="section" style={{ background: "var(--ivory)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>
          <Eyebrow>— Confidentialité par conception</Eyebrow>
          <h2
            className="serif"
            style={{ letterSpacing: "0.06em", maxWidth: 760, margin: "0 auto" }}
          >
            De ce que vous renseignez à <em>ce que reçoit le pro</em>.
          </h2>
          <p
            className="muted"
            style={{
              fontSize: "clamp(15px, 1.6vw, 18px)",
              lineHeight: 1.6,
              margin: "20px auto 0",
              maxWidth: 640,
            }}
          >
            Chaque donnée traverse une chaîne de transformation avant d&apos;être
            transmise. Voici, en un coup d&apos;œil, comment vos informations sont
            pseudonymisées par buupp.
          </p>
          <div style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
            <iframe
              src="/prototype/ano.html?v=ano9"
              title="Flux de pseudonymisation des données chez BUUPP"
              loading="lazy"
              style={{
                display: "block",
                width: "100%",
                maxWidth: 900,
                margin: "0 auto",
                aspectRatio: "1320 / 1300",
                border: "none",
                background: "transparent",
                // On estompe UNIQUEMENT les côtés (où se trouvent les taches de
                // couleur de l'illustration) pour dissoudre le rectangle dans
                // l'ivoire. Haut et bas restent nets : le bord est invisible
                // (même ivoire que la section) ET les labels du bas (« données
                // réelles et consenties », « 1 · Transmission », etc.) restent
                // pleinement visibles.
                WebkitMaskImage:
                  "linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%)",
                maskImage:
                  "linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%)",
              }}
            />
          </div>
        </div>
      </section>

      {/* 3 · Le tableau détaillé, désormais en ligne (sans popup) */}
      <section className="section">
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div
            style={{
              background: "var(--ivory)",
              border: "1px solid var(--line)",
              borderRadius: 26,
              overflow: "hidden",
              boxShadow: "0 30px 80px -40px rgba(10,22,40,.25)",
            }}
          >
            <div className="anon-hd" style={{ paddingRight: 40 }}>
              <div className="eb">CONFIDENTIALITÉ PAR CONCEPTION</div>
              <h3>Comment vos données sont pseudonymisées</h3>
              <div className="sub">
                Palier par palier&nbsp;: ce que vous renseignez, la transformation
                appliquée par buupp, et ce qui parvient réellement au
                professionnel.
              </div>
            </div>
            <div className="anon-body" style={{ overflow: "visible" }}>
              <PrivacyByDesignTable />
            </div>
          </div>
        </div>
      </section>

      {/* 4 · Les trois principes fondateurs */}
      <section
        className="section"
        style={{ background: "var(--ivory-2)", borderTop: "1px solid var(--line)" }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(36px, 5vw, 56px)" }}>
            <Eyebrow>— Nos trois principes</Eyebrow>
            <h2 className="serif" style={{ letterSpacing: "0.06em" }}>
              Trois exigences, <em>non négociables</em>.
            </h2>
          </div>
          <div className="grid grid-3">
            {PRINCIPLES.map((p) => (
              <div
                key={p.t}
                className="card"
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-md)",
                  padding: "28px 24px",
                }}
              >
                <div
                  className="row center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    marginBottom: 18,
                  }}
                >
                  <Icon name={p.icon} size={20} />
                </div>
                <div
                  className="serif"
                  style={{ fontSize: 22, marginBottom: 10, letterSpacing: "0.01em" }}
                >
                  {p.t}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--ink-3)" }}>
                  {p.d}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 · Sécurité & conformité */}
      <section
        className="section"
        data-nav-theme="dark"
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
                style={{ color: "var(--paper)", maxWidth: 720, letterSpacing: "0.06em" }}
              >
                Une architecture pensée pour que{" "}
                <em style={{ color: "#A5B4FC", letterSpacing: "0.08em" }}>
                  vos données
                </em>{" "}
                ne fuitent pas.
              </h2>
            </div>
          </div>
          <div className="grid grid-4" style={{ gap: 1, background: "rgba(255,255,255,.08)" }}>
            {SECURITY.map((p, i) => (
              <div key={i} style={{ background: "var(--ink)", padding: "24px 20px" }}>
                <div className="mono" style={{ fontSize: 20, color: "#A5B4FC", marginBottom: 14 }}>
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

      <Footer />
    </div>
  );
}
