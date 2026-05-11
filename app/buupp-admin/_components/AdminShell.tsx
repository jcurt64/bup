"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
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
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { signOut } = useClerk();

  const currentLabel = NAV.find((n) => n.href === pathname)?.label ?? "Admin";

  async function doSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut({ redirectUrl: "/" });
    } catch {
      setSigningOut(false);
    }
  }

  // Fermeture du modal de logout sur Escape (sauf si déjà en train de
  // se déconnecter — on évite que l'utilisateur annule l'action en cours).
  useEffect(() => {
    if (!confirmLogout) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !signingOut) setConfirmLogout(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmLogout, signingOut]);

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
            className="mt-auto pt-4 flex flex-col gap-2"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <div
              className="text-xs truncate"
              style={{ color: "var(--ink-5)", fontFamily: "var(--mono)" }}
              title={adminEmail}
            >
              {adminEmail}
            </div>
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 h-9 px-3 transition-colors cursor-pointer"
              style={{
                background: "var(--ivory-2)",
                color: "var(--ink-2)",
                border: "1px solid var(--line)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--danger)";
                e.currentTarget.style.color = "var(--paper)";
                e.currentTarget.style.borderColor = "var(--danger)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--ivory-2)";
                e.currentTarget.style.color = "var(--ink-2)";
                e.currentTarget.style.borderColor = "var(--line)";
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Se déconnecter
            </button>
          </div>
        </nav>
      </aside>

      {/* ─── Modal de confirmation de déconnexion ────────────────── */}
      {confirmLogout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(15,23,42,0.55)" }}
          onClick={() => !signingOut && setConfirmLogout(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="w-full max-w-sm rounded-lg p-6"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              boxShadow: "0 18px 48px -16px rgba(15,22,41,.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              id="logout-title"
              style={{
                fontFamily: "var(--serif)",
                fontSize: "20px",
                fontWeight: 500,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
              }}
            >
              Se déconnecter du back-office&nbsp;?
            </div>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--ink-3)", lineHeight: 1.5 }}
            >
              Tu seras redirigé vers la page d'accueil. Tu pourras te reconnecter
              en revenant sur <span style={{ fontFamily: "var(--mono)" }}>/buupp-admin</span>.
            </p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                disabled={signingOut}
                className="rounded-md text-sm font-medium h-10 px-4 inline-flex items-center justify-center cursor-pointer transition-colors"
                style={{
                  background: "var(--paper)",
                  color: "var(--ink-2)",
                  border: "1px solid var(--line)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--ivory-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--paper)";
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={doSignOut}
                disabled={signingOut}
                className="rounded-md text-sm font-medium h-10 px-4 inline-flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
                style={{
                  background: "var(--danger)",
                  color: "var(--paper)",
                  border: "1px solid var(--danger)",
                }}
              >
                {signingOut ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                    </svg>
                    Déconnexion…
                  </>
                ) : (
                  "Confirmer"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
