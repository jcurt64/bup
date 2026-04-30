"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: [string, string][] = [
  ["/", "Landing"],
  ["/waitlist", "Wait List"],
  ["/auth", "Auth"],
  ["/prospect", "Prospect"],
  ["/pro", "Pro"],
];

export default function RouteNav() {
  const pathname = usePathname();
  if (pathname === "/auth") return null;
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
        padding: 4,
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
      {TABS.map(([href, label]) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="route-nav-tab"
            style={{
              padding: "7px 14px",
              borderRadius: 999,
              background: active ? "#FBF9F3" : "transparent",
              color: active ? "#0F172A" : "rgba(255,255,255,.7)",
              fontWeight: active ? 500 : 400,
              transition: "all .15s",
              fontFamily: "var(--mono)",
              letterSpacing: ".04em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
