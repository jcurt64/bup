"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ALL_ACCEPTED,
  CONSENT_DURATION_MS,
  CONSENT_STORAGE_KEY,
  COOKIE_CATEGORIES,
  DEFAULT_CHOICES,
  type ConsentChoices,
  type ConsentState,
  type CookieCategoryId,
} from "./cookie-data";

const CONSENT_EVENT = "bupp:cookie-consent-changed";

// Cache module-level pour useSyncExternalStore : la même référence doit être
// renvoyée tant que le localStorage n'a pas changé, sinon React boucle.
let cachedRaw: string | null | undefined;
let cachedSnapshot: ConsentState | null = null;

function parseSnapshot(raw: string | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== 1) return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = parseSnapshot(raw);
  return cachedSnapshot;
}

function writeConsent(choices: ConsentChoices): ConsentState {
  const now = new Date();
  const state: ConsentState = {
    version: 1,
    decidedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CONSENT_DURATION_MS).toISOString(),
    choices: { ...choices, essential: true },
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(CONSENT_EVENT));
  } catch {}
  return state;
}

function subscribeConsent(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener(CONSENT_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(CONSENT_EVENT, cb);
  };
}

export default function CookieConsent() {
  // Le back-office /buupp-admin n'a pas vocation à recueillir un
  // consentement public — on masque le bouton/bandeau cookies. La
  // décision est calculée après les hooks pour respecter les Rules
  // of Hooks (early return uniquement avant le JSX).
  const pathname = usePathname();
  const isAdminScope = pathname?.startsWith("/buupp-admin") ?? false;

  const consent = useSyncExternalStore(
    subscribeConsent,
    readConsent,
    () => null,
  );

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Hydration gate: ne rendre qu'après mount client pour éviter un flash
    // du bandeau aux utilisateurs ayant déjà consenti (consent stocké en
    // localStorage, indisponible côté serveur).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [pending, setPending] = useState<ConsentChoices>(DEFAULT_CHOICES);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const persist = useCallback((choices: ConsentChoices) => {
    const next = writeConsent(choices);
    setPending(next.choices);
    setModalOpen(false);
  }, []);

  const acceptAll = useCallback(() => persist(ALL_ACCEPTED), [persist]);
  const refuseAll = useCallback(() => persist(DEFAULT_CHOICES), [persist]);
  const saveCustom = useCallback(() => persist(pending), [persist, pending]);

  const openModal = useCallback(() => {
    setPending(consent?.choices ?? DEFAULT_CHOICES);
    setModalOpen(true);
  }, [consent]);

  // Permet à n'importe quelle page (ex. /cookies) d'ouvrir le panneau de
  // préférences en dispatchant `bupp:open-cookie-modal`. Évite d'avoir à
  // remonter une référence du composant via un store global.
  useEffect(() => {
    const onOpen = () => openModal();
    window.addEventListener("bupp:open-cookie-modal", onOpen);
    return () => window.removeEventListener("bupp:open-cookie-modal", onOpen);
  }, [openModal]);

  if (!hydrated) return null;
  if (isAdminScope) return null;

  const bannerOpen = !consent;

  return (
    <>
      {bannerOpen ? (
        <CookieBanner
          onAcceptAll={acceptAll}
          onRefuseAll={refuseAll}
          onCustomize={openModal}
        />
      ) : null}

      <FloatingButton onClick={openModal} />

      {modalOpen ? (
        <CookieModal
          pending={pending}
          onChange={setPending}
          onClose={() => setModalOpen(false)}
          onAcceptAll={acceptAll}
          onRefuseAll={refuseAll}
          onSave={saveCustom}
        />
      ) : null}
    </>
  );
}

function CookieIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 1 0 10 10 5 5 0 0 1-5-5 5 5 0 0 1-5-5z" />
      <circle cx="8.5" cy="10.5" r="0.6" fill="currentColor" />
      <circle cx="13" cy="14" r="0.6" fill="currentColor" />
      <circle cx="15.5" cy="9" r="0.6" fill="currentColor" />
      <circle cx="9" cy="15" r="0.6" fill="currentColor" />
    </svg>
  );
}

function FloatingButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Gérer les cookies"
      title="Gérer les cookies"
      className="cookie-floating-btn"
      style={{
        position: "fixed",
        left: 22,
        bottom: 24,
        zIndex: 95,
        width: 44,
        height: 44,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        color: "var(--ink)",
        border: "1px solid var(--line-2)",
        boxShadow:
          "0 6px 16px -8px rgba(15,22,41,.30), 0 2px 6px rgba(15,22,41,.10)",
        cursor: "pointer",
        transition: "transform .15s ease, box-shadow .15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <CookieIcon size={20} />
    </button>
  );
}

function CookieBanner({
  onAcceptAll,
  onRefuseAll,
  onCustomize,
}: {
  onAcceptAll: () => void;
  onRefuseAll: () => void;
  onCustomize: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Bandeau de consentement aux cookies"
      className="cookie-banner"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 90,
        background: "var(--ink)",
        color: "var(--paper)",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.22)",
        padding: "clamp(16px, 3vw, 22px)",
        boxShadow: "0 24px 60px -20px rgba(15,22,41,.55)",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <div
        className="cookie-banner-row row between wrap gap-4"
        style={{ alignItems: "center" }}
      >
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div
            className="serif"
            style={{ fontSize: 18, marginBottom: 6, color: "var(--paper)" }}
          >
            Cookies & vie privée
          </div>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "rgba(255,255,255,.72)",
            }}
          >
            BUUPP utilise des cookies pour assurer le bon fonctionnement du
            site, mesurer son audience et améliorer votre expérience. Vous
            pouvez tout accepter, tout refuser ou choisir par catégorie.{" "}
            <Link
              href="/rgpd"
              style={{
                color: "var(--paper)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              En savoir plus
            </Link>
          </div>
        </div>

        <div
          className="cookie-banner-actions row gap-2 wrap"
          style={{ flex: "0 0 auto", justifyContent: "flex-end" }}
        >
          <button
            onClick={onRefuseAll}
            style={bannerBtnOutlineStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,.10)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Tout refuser
          </button>
          <button
            onClick={onCustomize}
            style={bannerBtnOutlineStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,.10)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Personnaliser
          </button>
          <button
            onClick={onAcceptAll}
            style={bannerBtnSolidStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
}

const bannerBtnBase = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 16px",
  borderRadius: 999,
  fontSize: 13.5,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background .15s, transform .15s",
  fontFamily: "var(--sans)",
} as const;

const bannerBtnOutlineStyle: React.CSSProperties = {
  ...bannerBtnBase,
  background: "transparent",
  color: "var(--paper)",
  border: "1px solid rgba(255,255,255,.35)",
};

const bannerBtnSolidStyle: React.CSSProperties = {
  ...bannerBtnBase,
  background: "var(--paper)",
  color: "var(--ink)",
  border: "1px solid var(--paper)",
  fontWeight: 600,
};

function CookieModal({
  pending,
  onChange,
  onClose,
  onAcceptAll,
  onRefuseAll,
  onSave,
}: {
  pending: ConsentChoices;
  onChange: (next: ConsentChoices) => void;
  onClose: () => void;
  onAcceptAll: () => void;
  onRefuseAll: () => void;
  onSave: () => void;
}) {
  const titleId = "cookie-modal-title";

  const toggle = (id: CookieCategoryId) => {
    onChange({ ...pending, [id]: !pending[id] });
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,22,41,.55)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          background: "var(--paper)",
          borderRadius: 16,
          padding: "clamp(20px, 4vw, 30px)",
          boxShadow:
            "0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)",
          margin: "auto 0",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          className="row between"
          style={{ alignItems: "flex-start", marginBottom: 14, gap: 10 }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="row center gap-2"
              style={{ flexWrap: "wrap", marginBottom: 8 }}
            >
              <span
                className="badge"
                style={{
                  background: "var(--ink)",
                  color: "var(--paper)",
                  borderColor: "var(--ink)",
                }}
              >
                <CookieIcon size={11} /> Cookies
              </span>
            </div>
            <h3
              id={titleId}
              className="serif"
              style={{
                fontSize: "clamp(20px, 2.4vw, 26px)",
                marginBottom: 6,
              }}
            >
              Vos préférences cookies
            </h3>
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.55,
                color: "var(--ink-3)",
              }}
            >
              Choisissez les cookies que vous souhaitez activer. Vous pouvez
              modifier ces choix à tout moment depuis le bouton flottant en bas
              à gauche.{" "}
              <Link
                href="/rgpd"
                style={{
                  color: "var(--accent)",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
                onClick={onClose}
              >
                Voir notre politique RGPD
              </Link>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-4)",
              padding: 4,
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div className="col gap-3" style={{ marginTop: 18 }}>
          {COOKIE_CATEGORIES.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              enabled={pending[cat.id]}
              onToggle={() => toggle(cat.id)}
            />
          ))}
        </div>

        <div
          className="row wrap gap-2"
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid var(--line)",
            justifyContent: "flex-end",
          }}
        >
          <button
            className="btn btn-ghost btn-sm"
            onClick={onRefuseAll}
            type="button"
          >
            Tout refuser
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onAcceptAll}
            type="button"
          >
            Tout accepter
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={onSave}
            type="button"
          >
            Enregistrer mes choix
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  enabled,
  onToggle,
}: {
  category: (typeof COOKIE_CATEGORIES)[number];
  enabled: boolean;
  onToggle: () => void;
}) {
  const detailsId = useMemo(() => `cookie-details-${category.id}`, [category.id]);
  const isOn = category.required ? true : enabled;

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "14px 16px",
        background: "var(--paper)",
      }}
    >
      <div
        className="row between"
        style={{ alignItems: "flex-start", gap: 12 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 15,
              color: "var(--ink)",
              marginBottom: 4,
            }}
          >
            {category.title}
            {category.required ? (
              <span
                className="mono"
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "var(--ink-4)",
                  background: "var(--ivory-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 999,
                  padding: "2px 7px",
                }}
              >
                Toujours actifs
              </span>
            ) : null}
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--ink-3)",
            }}
          >
            {category.description}
          </div>
          <div
            className="mono"
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "var(--ink-4)",
              letterSpacing: ".02em",
            }}
          >
            Base légale : {category.legalBasis}
          </div>
        </div>

        <Toggle
          checked={isOn}
          disabled={category.required}
          onChange={onToggle}
          label={`Activer ${category.title}`}
        />
      </div>

      <details style={{ marginTop: 10 }}>
        <summary
          style={{
            cursor: "pointer",
            fontSize: 12.5,
            color: "var(--ink-4)",
            userSelect: "none",
          }}
        >
          Détail des cookies ({category.cookies.length})
        </summary>
        <div
          id={detailsId}
          style={{
            marginTop: 10,
            border: "1px solid var(--line)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Fournisseur</th>
                  <th>Finalité</th>
                  <th>Durée</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {category.cookies.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <span className="chip">{c.name}</span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {c.provider}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {c.purpose}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {c.duration}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {c.type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}

function Toggle({
  checked,
  disabled = false,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        if (!disabled) onChange();
      }}
      disabled={disabled}
      style={{
        position: "relative",
        width: 42,
        height: 24,
        borderRadius: 999,
        background: checked ? "var(--accent)" : "var(--line-2)",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background .18s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.18)",
          transition: "left .18s",
        }}
      />
    </button>
  );
}
