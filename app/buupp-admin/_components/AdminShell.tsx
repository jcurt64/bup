"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import PeriodPicker from "./PeriodPicker";
import NotificationBell from "./NotificationBell";
import AdminIcon, { type AdminIconName } from "./AdminIcon";

export type NavCounts = {
  waitlist: number | null;
  campaigns: number | null;
  signalements: number | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: AdminIconName;
  /** Couleur d'accent de la pastille d'icône + du badge (cf. maquette). */
  accent: string;
  /** Clé de compteur affichée en pastille (cf. NavCounts). */
  badge?: keyof NavCounts;
};

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Principal",
    items: [
      { href: "/buupp-admin", label: "Vue d'ensemble", icon: "grid", accent: "#6366F1" },
      { href: "/buupp-admin/prospects", label: "Prospects", icon: "users", accent: "#10B981" },
      { href: "/buupp-admin/non-atteint", label: "Non atteint", icon: "phone-off", accent: "#F59E0B" },
      { href: "/buupp-admin/signalements", label: "Signalements", icon: "flag", accent: "#EC4899", badge: "signalements" },
      { href: "/buupp-admin/suggestions", label: "Suggestions", icon: "lightbulb", accent: "#8B5CF6" },
      { href: "/buupp-admin/contact-actions", label: "Activité pros", icon: "activity", accent: "#3B82F6" },
      { href: "/buupp-admin/contact-clicks", label: "Contacts (clics)", icon: "mouse-pointer", accent: "#22C55E" },
    ],
  },
  {
    title: "Gestion",
    items: [
      { href: "/buupp-admin/pros", label: "Professionnels", icon: "briefcase", accent: "#14B8A6" },
      { href: "/buupp-admin/campagnes", label: "Campagnes", icon: "megaphone", accent: "#6366F1", badge: "campaigns" },
      { href: "/buupp-admin/transactions", label: "Transactions", icon: "exchange", accent: "#F97316" },
      { href: "/buupp-admin/waitlist", label: "Waitlist", icon: "hourglass", accent: "#3B82F6", badge: "waitlist" },
      { href: "/buupp-admin/notifications", label: "Notifications", icon: "bell", accent: "#EC4899" },
      { href: "/buupp-admin/sante", label: "Santé", icon: "heart-pulse", accent: "#10B981" },
    ],
  },
];

const ALL_NAV = NAV_SECTIONS.flatMap((s) => s.items);

// Dérive un nom présentable + une initiale depuis l'email admin (on n'a
// pas de prénom en base). « jjlex64@gmail.com » → « Jjlex ».
function displayNameFromEmail(email: string): { name: string; initial: string } {
  const local = (email.split("@")[0] || "admin").replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
  const name = local
    ? local.split(" ").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "Admin";
  return { name, initial: (name.charAt(0) || "A").toUpperCase() };
}

export default function AdminShell({
  adminEmail,
  adminUserId,
  navCounts,
  children,
}: {
  adminEmail: string;
  adminUserId: string;
  navCounts?: NavCounts;
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

  const currentLabel = ALL_NAV.find((n) => n.href === pathname)?.label ?? "Admin";
  const { name: adminName, initial: adminInitial } = displayNameFromEmail(adminEmail);
  // Titre éditorial : dernier mot en italique accent (cf. maquette).
  const titleWords = currentLabel.split(" ");
  const titleLast = titleWords.pop() ?? "";
  const titleHead = titleWords.join(" ");

  async function doSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Renvoie sur l'écran de connexion du back-office avec un
      // redirect_url qui ramène automatiquement sur /buupp-admin après
      // une nouvelle authentification — pas besoin de retaper l'URL.
      await signOut({ redirectUrl: "/connexion?redirect_url=/buupp-admin" });
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
          {/* Logo : marque sombre + nom + sous-titre (cf. maquette da.png). */}
          <div className="hidden lg:flex items-center gap-2.5 mb-5 px-1">
            <span
              className="inline-flex items-center justify-center shrink-0"
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "var(--ink)",
                color: "var(--paper)",
                fontFamily: "var(--serif)",
                fontSize: 17,
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              B
            </span>
            <div className="leading-tight">
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: "var(--ink-2)",
                }}
              >
                BUUPP
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--ink-5)",
                }}
              >
                Admin console
              </div>
            </div>
          </div>

          {NAV_SECTIONS.map((section, si) => (
            <div key={section.title} className={si > 0 ? "mt-4" : ""}>
              <div
                className="px-3 mb-1.5"
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--ink-5)",
                }}
              >
                {section.title}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  // Boundary check : `/buupp-admin/prospects`.startsWith(`/buupp-admin/pros`)
                  // est true à tort. On exige soit l'égalité stricte, soit un `/`
                  // juste après le préfixe.
                  const active =
                    item.href === "/buupp-admin"
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(item.href + "/");
                  const count = item.badge ? navCounts?.[item.badge] ?? null : null;
                  return (
                    <Link
                      key={item.href}
                      href={`${item.href}${suffix}`}
                      onClick={() => setDrawerOpen(false)}
                      className="group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors"
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
                      <span
                        className="inline-flex items-center justify-center rounded-[9px] shrink-0"
                        style={{
                          width: 30,
                          height: 30,
                          background: active
                            ? "rgba(255,255,255,0.18)"
                            : `color-mix(in oklab, ${item.accent} 15%, var(--paper))`,
                          color: active ? "var(--paper)" : item.accent,
                        }}
                      >
                        <AdminIcon name={item.icon} size={17} />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {count != null && count > 0 && (
                        <span
                          className="shrink-0 inline-flex items-center justify-center rounded-full tabular-nums"
                          style={{
                            minWidth: 22,
                            height: 19,
                            padding: "0 6px",
                            fontSize: 10.5,
                            fontWeight: 700,
                            fontFamily: "var(--mono)",
                            background: active
                              ? "rgba(255,255,255,0.20)"
                              : `color-mix(in oklab, ${item.accent} 16%, var(--paper))`,
                            color: active ? "var(--paper)" : item.accent,
                          }}
                        >
                          {count > 999 ? "999+" : count}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div
            className="mt-auto pt-4 flex flex-col gap-2.5"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <div className="flex items-center gap-2.5 px-1">
              <span
                className="inline-flex items-center justify-center shrink-0 rounded-full"
                style={{
                  width: 36,
                  height: 36,
                  background: "var(--ink)",
                  color: "var(--paper)",
                  fontFamily: "var(--serif)",
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {adminInitial}
              </span>
              <div className="min-w-0">
                <div
                  className="truncate"
                  style={{ color: "var(--ink-2)", fontSize: 13.5, fontWeight: 600 }}
                >
                  {adminName}
                </div>
                <div
                  className="truncate"
                  style={{ color: "var(--ink-5)", fontSize: 11, fontFamily: "var(--mono)" }}
                  title={adminEmail}
                >
                  {adminEmail}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="rounded-lg text-[13px] font-medium inline-flex items-center gap-2 h-9 px-3 transition-colors cursor-pointer"
              style={{
                background: "transparent",
                color: "var(--ink-4)",
                border: "1px solid var(--line)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--danger)";
                e.currentTarget.style.color = "var(--paper)";
                e.currentTarget.style.borderColor = "var(--danger)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--ink-4)";
                e.currentTarget.style.borderColor = "var(--line)";
              }}
            >
              <AdminIcon name="logout" size={15} />
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
              Tu seras redirigé vers l&apos;écran de connexion du back-office.
              Une fois reconnecté, tu reviendras automatiquement ici.
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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <div
              className="flex items-center gap-2 mb-1.5"
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--ink-4)",
              }}
            >
              <span
                aria-hidden
                style={{ width: 22, height: 1.5, background: "var(--accent, #6366F1)", display: "inline-block" }}
              />
              Console d&apos;administration
            </div>
            <h1
              style={{
                fontFamily: "var(--serif)",
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
                lineHeight: 1.05,
              }}
            >
              {titleHead && <span>{titleHead} </span>}
              <em>{titleLast}</em>
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell adminUserId={adminUserId} />
            <PeriodPicker />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
