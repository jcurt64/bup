"use client";

import {
  useState,
  useEffect,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import LogoutConfirmModal from "./LogoutConfirmModal";

/**
 * Chrome partagée du site (en-tête + pied de page) extraite de HomeClient afin
 * d'être réutilisée par les pages autonomes « À propos » et « Contact ».
 *
 * Les liens de navigation pointent désormais vers de vraies routes :
 *   — sections de la home : ancres `/#prospects`, `/#pros`, `/#tarifs`
 *   — À propos → /about, Contact → /contact (pages dédiées)
 */

export type IconName =
  | "arrow"
  | "check"
  | "sparkle"
  | "bolt"
  | "target"
  | "wallet"
  | "trend"
  | "gauge"
  | "close"
  | "clock"
  | "shield"
  | "lock"
  | "mail"
  | "user"
  | "briefcase"
  | "gear";

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
  close: <path d="M18 6L6 18M6 6l12 12" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />,
  lock: (
    <>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
      <path d="M8.5 7.5V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 12.5h18" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.2l1.6 2.5 2.9-.7.4 3 2.8 1.1-1.3 2.7 1.3 2.7-2.8 1.1-.4 3-2.9-.7L12 21.8l-1.6-2.5-2.9.7-.4-3-2.8-1.1 1.3-2.7-1.3-2.7 2.8-1.1.4-3 2.9.7z" />
    </>
  ),
};

export function Icon({
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

// Ballon de foot réaliste (marqueur Coupe du Monde) — jumeau du WorldCupBall
// du prototype (Shell.jsx). Pentagone central + 5 pentagones de bord + coutures ;
// sphère 3D via deux cercles décalés. Tourne via `.wc-ball-spin` (globals.css).
// Décoratif → aria-hidden. Temporaire.
export function WorldCupBall({ size = 18 }: { size?: number }) {
  return (
    <span className="wc-ball-drop" style={{ flex: "0 0 auto" }}>
    <svg
      className="wc-ball-spin"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "0 0 auto" }}
    >
      <circle cx="32" cy="32" r="30" fill="#d9d9d9" stroke="#2a2a2a" strokeWidth="1.5" />
      <circle cx="30" cy="29.5" r="27.5" fill="#fbfbfb" />
      <g fill="#161616">
        <polygon points="32.00,22.50 41.04,29.06 37.58,39.69 26.42,39.69 22.96,29.06" />
        <polygon points="32.00,3.90 39.23,9.15 36.47,17.65 27.53,17.65 24.77,9.15" />
        <polygon points="58.72,23.32 55.96,31.81 47.03,31.81 44.27,23.32 51.50,18.07" />
        <polygon points="48.52,54.73 39.58,54.73 36.82,46.24 44.05,40.98 51.28,46.24" />
        <polygon points="15.48,54.73 12.72,46.24 19.95,40.98 27.18,46.24 24.42,54.73" />
        <polygon points="5.28,23.32 12.50,18.07 19.73,23.32 16.97,31.81 8.04,31.81" />
      </g>
      <g stroke="#2b2b2b" strokeWidth="1.6" strokeLinecap="round">
        <line x1="32.00" y1="22.50" x2="32.00" y2="17.65" />
        <line x1="41.04" y1="29.06" x2="45.65" y2="27.57" />
        <line x1="37.58" y1="39.69" x2="40.44" y2="43.61" />
        <line x1="26.42" y1="39.69" x2="23.56" y2="43.61" />
        <line x1="22.96" y1="29.06" x2="18.35" y2="27.57" />
      </g>
    </svg>
    </span>
  );
}

export function Logo({
  size = 50,
  color,
  onClick,
}: {
  size?: number;
  color?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="row center" style={{ color: color || "inherit", gap: 8 }}>
      <WorldCupBall size={Math.round(size * 0.42)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="BUUPP"
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

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Tant que Clerk n'a pas terminé l'hydratation, on ne sait pas s'il
  // faut afficher "Démarrer" ou "Se déconnecter" — on opte pour
  // l'affichage par défaut (Démarrer) afin d'éviter un flash visuel
  // côté visiteurs anonymes (cas le plus fréquent sur la home).
  const showLogout = isLoaded && !!isSignedIn;

  const askLogout = () => {
    setOpen(false); // ferme le drawer mobile si ouvert
    setLogoutOpen(true);
  };
  const doLogout = async () => {
    await signOut({ redirectUrl: "/" });
  };

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

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  // Clic logo : remonte en haut sur la home, sinon ramène à l'accueil.
  const onLogo = () => {
    setOpen(false);
    if (pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" });
    else router.push("/");
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
          style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 20px", position: "relative" }}
          className="row between center"
        >
          <div className="row center" style={{ gap: 32 }}>
            <Logo size={50} onClick={onLogo} />
            <nav className="row gap-6 nav-desktop" style={{ marginLeft: 8 }}>
              <Link className="nav-link" href="/#prospects">
                Prospect
              </Link>
              <Link className="nav-link" href="/#pros">
                Professionnel
              </Link>
              <Link className="nav-link" href="/#tarifs">
                Tarifs
              </Link>
            </nav>
          </div>

          {/* Liens accentués centrés dans le header (police manuscrite) */}
          <nav
            className="nav-desktop"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              gap: 28,
            }}
          >
            <Link
              className="nav-link"
              href="/about"
              style={{
                fontFamily: "var(--font-caveat), cursive",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: 0,
                color: "var(--accent)",
                lineHeight: 1,
                transform: "rotate(-3deg)",
                display: "inline-block",
              }}
            >
              À propos
            </Link>
            <Link
              className="nav-link"
              href="/contact"
              style={{
                fontFamily: "var(--font-caveat), cursive",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: 0,
                color: "#C2410B",
                lineHeight: 1,
                transform: "rotate(-3deg)",
                display: "inline-block",
              }}
            >
              Contact
            </Link>
          </nav>

          <div className="row center gap-3 nav-desktop">
            {showLogout ? (
              <button
                className="btn btn-sm btn-primary"
                onClick={askLogout}
              >
                Se déconnecter <Icon name="arrow" size={14} />
              </button>
            ) : (
              <>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => router.push("/inscription/prospect")}
                >
                  S&apos;inscrire en tant que prospect
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => router.push("/inscription/pro")}
                >
                  S&apos;inscrire en tant que pro{" "}
                  <Icon name="arrow" size={14} />
                </button>
              </>
            )}
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
          <button className="drawer-link" onClick={() => go("/#prospects")}>
            Prospect
          </button>
          <button className="drawer-link" onClick={() => go("/#pros")}>
            Professionnel
          </button>
          <button className="drawer-link" onClick={() => go("/#tarifs")}>
            Tarifs
          </button>
          <button
            className="drawer-link"
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontSize: 26,
              fontWeight: 700,
              color: "var(--accent)",
            }}
            onClick={() => go("/about")}
          >
            <span style={{ display: "inline-block", transform: "rotate(-3deg)" }}>
              À propos
            </span>
          </button>
          <button
            className="drawer-link"
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontSize: 26,
              fontWeight: 700,
              color: "#C2410B",
            }}
            onClick={() => go("/contact")}
          >
            <span style={{ display: "inline-block", transform: "rotate(-3deg)" }}>
              Contact
            </span>
          </button>
          <div className="drawer-ctas">
            {showLogout ? (
              <button
                className="btn btn-lg btn-primary"
                style={{ justifyContent: "center" }}
                onClick={askLogout}
              >
                Se déconnecter <Icon name="arrow" size={14} />
              </button>
            ) : (
              <>
                <button
                  className="btn btn-lg btn-ghost"
                  style={{ justifyContent: "center" }}
                  onClick={() => go("/inscription/prospect")}
                >
                  S&apos;inscrire en tant que prospect
                </button>
                <button
                  className="btn btn-lg btn-primary"
                  style={{ justifyContent: "center" }}
                  onClick={() => go("/inscription/pro")}
                >
                  S&apos;inscrire en tant que pro{" "}
                  <Icon name="arrow" size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <LogoutConfirmModal
        open={logoutOpen}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={doLogout}
      />
    </>
  );
}

export function Footer() {
  const router = useRouter();
  const pathname = usePathname();
  type Item = { label: string; href?: string };
  const columns: [string, Item[]][] = [
    [
      "Plateforme",
      [
        { label: "Prospects", href: "/#prospects" },
        { label: "Professionnels", href: "/#pros" },
        { label: "Tarifs", href: "/#tarifs" },
        { label: "À propos", href: "/about" },
        { label: "Contact", href: "/contact" },
      ],
    ],
    [
      "Ressources",
      [
        { label: "Barème des paliers", href: "/bareme" },
        { label: "Documentation", href: "/aide" },
        { label: "Status", href: "/status" },
        { label: "Accessibilité", href: "/accessibilite" },
        { label: "Minimisation", href: "/minimisation" },
      ],
    ],
    [
      "Légal",
      [
        { label: "CGU", href: "/cgu" },
        { label: "CGV", href: "/cgv" },
        { label: "RGPD", href: "/rgpd" },
        { label: "Politique des cookies", href: "/cookies" },
        { label: "Contact DPO", href: "/contact-dpo" },
      ],
    ],
  ];
  const onLogo = () => {
    if (pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" });
    else router.push("/");
  };
  return (
    <footer
      data-nav-theme="dark"
      style={{
        padding: "56px 20px 96px",
        background: "var(--ink)",
        color: "rgba(255,255,255,.6)",
        fontSize: 13,
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div
          className="row between wrap footer-grid"
          style={{ gap: 32, marginBottom: 40, alignItems: "flex-start" }}
        >
          <div className="footer-brand" style={{ flex: "1 1 240px", maxWidth: 320 }}>
            <Logo size={50} color="var(--paper)" onClick={onLogo} />
            <div className="footer-brand-info" style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6 }}>
              BUUPPP est développée et exploitée par la société Majelink · 12
              Impasse des Étriers, 64140 Lons · RCS Pau 892 514 167.
            </div>
          </div>
          {columns.map(([h, items]) => (
            <div
              key={h}
              className="footer-col"
              style={{ flex: "1 1 140px", minWidth: 120 }}
            >
              <div
                className="mono caps"
                style={{ color: "rgba(255,255,255,.4)", marginBottom: 12 }}
              >
                {h}
              </div>
              {items.map((it) => {
                if (!it.href) {
                  return (
                    <div key={it.label} style={{ padding: "4px 0" }}>
                      {it.label}
                    </div>
                  );
                }
                // Pour les ancres internes (`/#xxx`), on utilise un <a>
                // natif plutôt que <Link> : Next/Link fait un scroll
                // programmatique qui ignore `scroll-behavior: smooth`.
                // Avec un <a>, le navigateur prend la main et applique
                // bien le défilement fluide défini dans globals.css.
                const linkStyle = {
                  display: "block",
                  padding: "4px 0",
                  color: "inherit",
                  textDecoration: "none",
                  transition: "color .15s",
                } as const;
                const onEnter = (e: ReactMouseEvent<HTMLElement>) =>
                  (e.currentTarget.style.color = "var(--paper)");
                const onLeave = (e: ReactMouseEvent<HTMLElement>) =>
                  (e.currentTarget.style.color = "");
                if (it.href.includes("#")) {
                  return (
                    <a
                      key={it.label}
                      href={it.href}
                      style={linkStyle}
                      onMouseEnter={onEnter}
                      onMouseLeave={onLeave}
                    >
                      {it.label}
                    </a>
                  );
                }
                return (
                  <Link
                    key={it.label}
                    href={it.href}
                    style={linkStyle}
                    onMouseEnter={onEnter}
                    onMouseLeave={onLeave}
                  >
                    {it.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div
          className="row between wrap gap-2 footer-bottom"
          style={{
            borderTop: "1px solid rgba(255,255,255,.1)",
            paddingTop: 20,
            fontSize: 12,
          }}
        >
          <div>© 2026 Majelink. Tous droits réservés.</div>
          <div className="row gap-4 footer-locale">
            <span>Français</span>
            <span>EUR €</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
