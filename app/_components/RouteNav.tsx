"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; icon: ReactNode };

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

const TABS: Tab[] = [
  {
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
  {
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
  {
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
  {
    href: "/prospect",
    label: "Prospect",
    icon: (
      <Svg>
        <circle cx={12} cy={8} r={4} />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </Svg>
    ),
  },
  {
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
];

export default function RouteNav() {
  const pathname = usePathname();
  if (pathname === "/connexion") return null;
  return (
    <div
      className="route-nav"
      style={{
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
      }}
    >
      {TABS.map(({ href, label, icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="route-nav-tab"
            aria-label={label}
            title={label}
            style={{
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
            }}
          >
            <span className="route-nav-icon" aria-hidden>{icon}</span>
            <span className="route-nav-label">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
