"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import PeriodPicker from "./PeriodPicker";
import NotificationBell from "./NotificationBell";

const NAV = [
  { href: "/buupp-admin", label: "Vue d'ensemble" },
  { href: "/buupp-admin/prospects", label: "Prospects" },
  { href: "/buupp-admin/pros", label: "Professionnels" },
  { href: "/buupp-admin/campagnes", label: "Campagnes" },
  { href: "/buupp-admin/transactions", label: "Transactions" },
  { href: "/buupp-admin/waitlist", label: "Waitlist" },
  { href: "/buupp-admin/sante", label: "Santé" },
];

export default function AdminShell({
  adminEmail,
  adminUserId,
  children,
}: {
  adminEmail: string;
  adminUserId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const period = sp.get("period");
  const suffix = period ? `?period=${period}` : "";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentLabel = NAV.find((n) => n.href === pathname)?.label ?? "Admin";

  return (
    <div
      className="buupp-admin-scope min-h-screen lg:grid lg:grid-cols-[260px_1fr]"
      style={{ background: "var(--ivory)", color: "var(--ink)", fontFamily: "var(--sans)" }}
    >
      {/* ─── Topbar mobile (hamburger + titre) ───────────────────── */}
      <header
        className="lg:hidden flex items-center justify-between px-4 py-3 border-b"
        style={{ background: "var(--paper)", borderColor: "var(--line)" }}
      >
        <button
          aria-label="Menu"
          onClick={() => setDrawerOpen((o) => !o)}
          className="inline-flex items-center justify-center w-10 h-10 rounded-md"
          style={{ background: "var(--ivory-2)", color: "var(--ink)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <div style={{ fontFamily: "var(--serif)", fontSize: "18px", fontWeight: 500 }}>BUUPP Admin</div>
        <div className="w-10" />
      </header>

      {/* ─── Sidebar (drawer mobile / fixed desktop) ─────────────── */}
      <aside
        className={`${drawerOpen ? "block" : "hidden"} lg:block fixed lg:static inset-0 lg:inset-auto z-40 lg:z-auto`}
      >
        {/* Backdrop mobile */}
        {drawerOpen && (
          <div
            className="lg:hidden absolute inset-0"
            style={{ background: "rgba(15,23,42,.45)" }}
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <nav
          className="relative flex flex-col gap-1 p-4 lg:h-screen lg:sticky lg:top-0 w-[260px] max-w-[85vw] lg:w-auto"
          style={{
            background: "var(--paper)",
            borderRight: "1px solid var(--line)",
            color: "var(--ink)",
          }}
        >
          <div
            className="hidden lg:block mb-6"
            style={{ fontFamily: "var(--serif)", fontSize: "16px", fontWeight: 500, letterSpacing: "-0.01em", color: "var(--ink-3)" }}
          >
            BUUPP Admin
          </div>
          {NAV.map((item) => {
            // Boundary check : `/buupp-admin/prospects`.startsWith(`/buupp-admin/pros`)
            // est true à tort. On exige soit l'égalité stricte, soit un `/`
            // juste après le préfixe.
            const active =
              item.href === "/buupp-admin"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={`${item.href}${suffix}`}
                onClick={() => setDrawerOpen(false)}
                className="rounded-md px-3 py-2 text-[14px] transition-colors"
                style={
                  active
                    ? { background: "var(--ink)", color: "var(--paper)", fontWeight: 500 }
                    : { color: "var(--ink-3)" }
                }
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "var(--ivory-2)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <div
            className="mt-auto pt-4 text-xs"
            style={{ color: "var(--ink-5)", borderTop: "1px solid var(--line)", fontFamily: "var(--mono)" }}
          >
            {adminEmail}
          </div>
        </nav>
      </aside>

      {/* ─── Main ────────────────────────────────────────────────── */}
      <main className="px-4 py-5 lg:px-8 lg:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h1
            style={{
              fontFamily: "var(--serif)",
              fontSize: "20px",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
            }}
          >
            {currentLabel}
          </h1>
          <div className="flex items-center gap-2">
            <NotificationBell adminUserId={adminUserId} />
            <PeriodPicker />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
