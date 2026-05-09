"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Role } from "@/lib/sync/ensureRole";

type TabId = "accueil" | "liste-attente" | "prospect" | "pro" | "connexion";

type Tab = {
  id: TabId;
  href: string;
  label: string;
  icon: ReactNode;
};

const Svg = ({ children }: { children: ReactNode }) => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

const TAB_DEFS: Record<TabId, Tab> = {
  accueil: {
    id: "accueil",
    href: "/",
    label: "Accueil",
    icon: (
      <Svg>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </Svg>
    ),
  },
  "liste-attente": {
    id: "liste-attente",
    href: "/liste-attente",
    label: "Liste d'attente",
    icon: (
      <Svg>
        <path d="M6 2h12" />
        <path d="M6 22h12" />
        <path d="M6 2v4l6 6-6 6v4" />
        <path d="M18 2v4l-6 6 6 6v4" />
      </Svg>
    ),
  },
  prospect: {
    id: "prospect",
    href: "/prospect",
    label: "Prospect",
    icon: (
      <Svg>
        <circle cx={12} cy={8} r={4} />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </Svg>
    ),
  },
  pro: {
    id: "pro",
    href: "/pro",
    label: "Pro",
    icon: (
      <Svg>
        <rect x={3} y={7} width={18} height={13} rx={2} />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        <path d="M3 13h18" />
      </Svg>
    ),
  },
  connexion: {
    id: "connexion",
    href: "/connexion",
    label: "Connexion",
    icon: (
      <Svg>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
      </Svg>
    ),
  },
};

const PUBLIC_TABS: TabId[] = ["accueil", "liste-attente", "connexion"];
const PROSPECT_TABS: TabId[] = ["accueil", "liste-attente", "prospect"];
const PRO_TABS: TabId[] = ["accueil", "liste-attente", "pro"];

const containerStyle: CSSProperties = {
  position: "fixed",
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(15, 23, 42, 0.92)",
  color: "#FBF9F3",
  padding: "6px 6px",
  borderRadius: 999,
  zIndex: 90,
  backdropFilter: "blur(10px)",
  boxShadow: "0 10px 30px -10px rgba(0,0,0,.4)",
  display: "flex",
  gap: 2,
  fontSize: 12,
  whiteSpace: "nowrap",
};

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 999,
    background: active ? "#FBF9F3" : "transparent",
    color: active ? "#0F172A" : "rgba(255,255,255,.7)",
    fontWeight: active ? 500 : 400,
    transition: "all .15s",
    fontFamily: "var(--mono)",
    letterSpacing: ".04em",
    textTransform: "uppercase",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
    border: 0,
  };
}

export default function RouteNav() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user } = useUser();
  // Cache instant : publicMetadata.role lu depuis le session token Clerk.
  // Peut être stale juste après une re-synchro côté serveur (ex.
  // ensureRole vient de basculer le rôle, le token n'a pas encore été
  // rafraîchi côté client). On prend donc /api/me/role comme source
  // de vérité et on l'utilise dès qu'il a répondu.
  const cachedRole =
    isSignedIn
      ? ((user?.publicMetadata as { role?: Role } | undefined)?.role ?? null)
      : null;
  const [dbRole, setDbRole] = useState<Role | null>(null);
  const [dbChecked, setDbChecked] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setDbRole(null);
      setDbChecked(true);
      return;
    }
    let cancelled = false;
    fetch("/api/me/role", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { role?: Role | null } | null) => {
        if (cancelled) return;
        setDbRole(j?.role ?? null);
        setDbChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDbChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  // Masquer la nav sur les pages d'auth (full-screen Clerk).
  if (pathname === "/connexion" || pathname.startsWith("/inscription")) return null;
  // Évite un flash de tabs incorrects pendant l'hydratation Clerk.
  if (!isLoaded) return null;

  // Le pathname est un signal de rôle FIABLE : si le user est sur
  // /prospect (resp. /pro), c'est que le garde serveur de cette page
  // l'a laissé passer — donc son rôle DB matche. Avant que /api/me/role
  // ait répondu, on évite ainsi la contradiction "URL=/prospect mais
  // onglet pro affiché" que provoquait le cache Clerk stale.
  // On compare le premier segment exact pour ne pas que /prospect
  // matche aussi le préfixe /pro.
  const firstSegment = pathname.split("/")[1] ?? "";
  const inferredFromPath: Role | null =
    firstSegment === "prospect" ? "prospect"
    : firstSegment === "pro" ? "pro"
    : null;

  // Priorité : DB si vérifié → URL inférée → cache Clerk (potentiellement
  // stale). Tant qu'on n'a aucun signal, on retombe sur les tabs publics
  // — préférable à un onglet incorrect.
  const role: Role | null = isSignedIn
    ? (dbChecked
        ? (dbRole ?? inferredFromPath ?? cachedRole)
        : (inferredFromPath ?? cachedRole))
    : null;

  const visibleIds: TabId[] =
    role === "pro" ? PRO_TABS : role === "prospect" ? PROSPECT_TABS : PUBLIC_TABS;

  return (
    <div className="route-nav" style={containerStyle}>
      {visibleIds.map((id) => {
        const t = TAB_DEFS[id];
        const active = pathname === t.href;
        return (
          <Link
            key={id}
            href={t.href}
            className="route-nav-tab"
            aria-label={t.label}
            title={t.label}
            style={tabStyle(active)}
          >
            <span className="route-nav-icon" aria-hidden>{t.icon}</span>
            <span className="route-nav-label">{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
