"use client";

import {
  useState,
  useEffect,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
  | "info"
  | "gear"
  | "video";

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
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 11h1v5h1" />
    </>
  ),
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
  // Caméra : corps rectangulaire + objectif en biseau. Lisible dès 14px,
  // contrairement à une pellicule dont les perforations se bouchent.
  video: (
    <>
      <rect x="2.5" y="6" width="13" height="12" rx="3" />
      <path d="M15.5 11l6-3.2v8.4l-6-3.2z" />
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
      <Image
        src="/logo.png"
        alt="BUUPP"
        width={800}
        height={295}
        priority
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
          // Effet « liquid glass » au scroll : fond ivoire translucide +
          // flou et saturation marqués (verre dépoli), liseré sombre discret,
          // ombre douce et reflet clair en haut pour la brillance du verre.
          // Au repos (haut de page), fond ivoire plein : un fond transparent
          // par-dessus le hero sombre rendrait les liens (sombres) illisibles.
          background:
            scrolled || open ? "rgba(247,244,236,.48)" : "var(--ivory)",
          backdropFilter:
            scrolled || open ? "blur(18px) saturate(180%)" : "none",
          WebkitBackdropFilter:
            scrolled || open ? "blur(18px) saturate(180%)" : "none",
          borderBottom:
            scrolled || open
              ? "1px solid rgba(15,23,42,.07)"
              : "1px solid transparent",
          boxShadow:
            scrolled || open
              ? "0 6px 24px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.6)"
              : "none",
          transition: "background .25s, border-color .25s, box-shadow .25s",
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
                fontFamily: "var(--font-josefin), sans-serif",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 0,
                color: "var(--accent)",
                lineHeight: 0.95,
                display: "inline-block",
                textAlign: "center",
              }}
            >
              Buupp &amp;<br />vos données
            </Link>
            <Link
              className="nav-link"
              href="/contact"
              style={{
                fontFamily: "var(--font-josefin), sans-serif",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 0,
                color: "#C2410B",
                lineHeight: 1,
                display: "inline-block",
              }}
            >
              Contact
            </Link>
            {/* Vidéos : entre les liens accentués et les CTA de compte —
                on regarde avant de s'engager. */}
            <Link className="btn-videos" href="/tutoriels">
              <Icon name="video" size={15} /> Vidéos
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

          {/* Sous 880px la nav centrée disparaît : le bouton Vidéos reste
              néanmoins dans l'en-tête, à gauche du hamburger. Le conteneur
              est masqué au-dessus du seuil pour ne pas peser comme un
              troisième élément flex et déséquilibrer le header desktop. */}
          <div className="nav-mobile-actions">
            <Link className="btn-videos btn-videos-mobile" href="/tutoriels">
              <Icon name="video" size={15} />{" "}
              <span className="btn-videos-label">Vidéos</span>
            </Link>

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
              fontFamily: "var(--font-josefin), sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: "var(--accent)",
            }}
            onClick={() => go("/about")}
          >
            <span style={{ display: "inline-block", textAlign: "center", lineHeight: 0.95 }}>
              Buupp &amp;<br />vos données
            </span>
          </button>
          <button
            className="drawer-link"
            style={{
              fontFamily: "var(--font-josefin), sans-serif",
              fontSize: 18,
              fontWeight: 700,
              color: "#C2410B",
            }}
            onClick={() => go("/contact")}
          >
            <span style={{ display: "inline-block" }}>
              Contact
            </span>
          </button>
          <button className="drawer-link" onClick={() => go("/tutoriels")}>
            <span className="row center" style={{ gap: 8 }}>
              <Icon name="video" size={16} /> Vidéos
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
        { label: "Buupp & vos données", href: "/about" },
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
        { label: "Contact chargé de la protection des données", href: "/contact-dpo" },
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
              BUUPP est développée et exploitée par la société Majelink · 12
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
          <div
            className="footer-col"
            style={{ flex: "1 1 140px", minWidth: 120 }}
          >
            <div
              className="mono caps"
              style={{ color: "rgba(255,255,255,.4)", marginBottom: 12 }}
            >
              Suivez-nous
            </div>
            <a
              href="https://www.facebook.com/profile.php?id=61590629948220"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Page Facebook BUUPP"
              style={{
                display: "block",
                padding: "4px 0",
                color: "inherit",
                textDecoration: "none",
                transition: "color .15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--paper)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              Facebook
            </a>
            <a
              href="https://www.tiktok.com/@buupp5"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compte TikTok BUUPP"
              style={{
                display: "block",
                padding: "4px 0",
                color: "inherit",
                textDecoration: "none",
                transition: "color .15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--paper)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              TikTok
            </a>
            <a
              href="https://www.linkedin.com/company/129694029"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Page LinkedIn BUUPP"
              style={{
                display: "block",
                padding: "4px 0",
                color: "inherit",
                textDecoration: "none",
                transition: "color .15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--paper)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              LinkedIn
            </a>
          </div>
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
