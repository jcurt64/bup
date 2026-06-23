/**
 * Jeu d'icônes stroke (style Feather) pour le back-office BUUPP.
 * Rendu en `currentColor` → la couleur se pilote via `color` / `stroke`
 * du parent. Utilisé par la sidebar, les cartes KPI, les graphiques et
 * le live feed pour aligner l'iconographie sur la maquette `da.png`.
 */

import type { SVGProps } from "react";

export type AdminIconName =
  // KPI
  | "users"
  | "briefcase"
  | "hourglass"
  | "megaphone"
  | "send"
  | "line-chart"
  | "wallet"
  | "currency"
  | "coins"
  | "credit-card"
  | "trending-up"
  // graphiques
  | "activity"
  | "bar-chart"
  | "euro"
  // sidebar
  | "grid"
  | "phone-off"
  | "flag"
  | "lightbulb"
  | "mouse-pointer"
  | "exchange"
  | "bell"
  | "heart-pulse"
  | "logout"
  // live feed
  | "check"
  | "message"
  | "user-plus"
  | "alert-triangle"
  | "clock"
  | "flag-check";

const PATHS: Record<AdminIconName, React.ReactNode> = {
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 2h12M6 22h12" />
      <path d="M6 2c0 5 6 5 6 10S6 17 6 22" />
      <path d="M18 2c0 5-6 5-6 10s6 5 6 10" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 11l15-6v14L3 13z" />
      <path d="M3 11v2a2 2 0 0 0 2 2h1v3a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-3" />
    </>
  ),
  send: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </>
  ),
  "line-chart": (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l3-4 3 3 5-7" />
    </>
  ),
  wallet: (
    <>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </>
  ),
  currency: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5a3 3 0 0 0-3-1.5c-1.5 0-3 .8-3 2.2 0 2.8 6 1.3 6 4 0 1.4-1.5 2.3-3 2.3a3 3 0 0 1-3-1.5" />
      <path d="M12 6.5v11" />
    </>
  ),
  coins: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="M16.71 13.88l.7.71-2.82 2.82" />
    </>
  ),
  "credit-card": (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  "trending-up": (
    <>
      <path d="M23 6l-9.5 9.5-5-5L1 18" />
      <path d="M17 6h6v6" />
    </>
  ),
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  "bar-chart": (
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="11" width="3" height="6" />
      <rect x="12" y="8" width="3" height="9" />
      <rect x="17" y="13" width="3" height="4" />
    </>
  ),
  euro: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 8.5a4 4 0 1 0 0 7" />
      <path d="M7 11h6M7 13.5h6" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </>
  ),
  "phone-off": (
    <>
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.29.62 2 2 0 0 1 1.72 2v2.92a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-3.33-2.67" />
      <path d="M5.09 5.09A19.8 19.8 0 0 1 4 4.27 2 2 0 0 1 6 2.18h2.92a2 2 0 0 1 2 1.72c.13.81.34 1.6.62 2.34" />
      <path d="M1 1l22 22" />
    </>
  ),
  flag: (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </>
  ),
  lightbulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.79.64-1.42 1.41-2.13A5 5 0 1 0 7.5 11.87c.77.71 1.23 1.34 1.41 2.13" />
    </>
  ),
  "mouse-pointer": (
    <>
      <path d="M3 3l7.07 17 2.51-7.39L20 10.07z" />
      <path d="M13 13l6 6" />
    </>
  ),
  exchange: (
    <>
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  "heart-pulse": (
    <>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z" />
      <path d="M3.5 12h4l1.5-3 2.5 6 1.5-3h4" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  message: (
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  ),
  "user-plus": (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </>
  ),
  "alert-triangle": (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  "flag-check": (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
      <path d="M9 8l1.5 1.5L14 6" />
    </>
  ),
};

export default function AdminIcon({
  name,
  size = 20,
  ...rest
}: { name: AdminIconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
