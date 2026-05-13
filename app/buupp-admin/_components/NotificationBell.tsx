"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EVENT_META, type AdminEventLike } from "./eventMeta";

type AdminEvent = AdminEventLike & {
  read_by: Record<string, string>;
};

const SEVERITY_STYLES: Record<AdminEvent["severity"], { borderColor: string; bg: string }> = {
  info: { borderColor: "var(--line-2)", bg: "var(--paper)" },
  warning: { borderColor: "var(--warn)", bg: "rgba(180, 83, 9, 0.06)" },
  critical: { borderColor: "var(--danger)", bg: "rgba(185, 28, 28, 0.06)" },
};

export default function NotificationBell({ adminUserId }: { adminUserId: string }) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/events?limit=100")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []));
    const es = new EventSource("/api/admin/events/stream");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type !== "event") return;
        // Dédup par id : le SSE renvoie le backlog (10 derniers) à
        // chaque (re)connexion ET le fetch initial a déjà chargé les 100
        // derniers — sans ce guard, React crashe avec "duplicate keys".
        setEvents((cur) => {
          if (cur.some((e) => e.id === msg.payload.id)) return cur;
          return [msg.payload, ...cur].slice(0, 200);
        });
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  // Fermeture au clic à l'extérieur + Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = events.filter((e) => !e.read_by?.[adminUserId]);

  async function markOne(id: string) {
    setEvents((cur) =>
      cur.map((e) =>
        e.id === id
          ? { ...e, read_by: { ...(e.read_by || {}), [adminUserId]: new Date().toISOString() } }
          : e,
      ),
    );
    try {
      await fetch(`/api/admin/events/${id}/read`, { method: "POST" });
    } catch {
      /* best-effort */
    }
  }

  async function markAll() {
    const ids = unread.map((e) => e.id);
    if (ids.length === 0) return;
    setEvents((cur) =>
      cur.map((e) => ({
        ...e,
        read_by: { ...(e.read_by || {}), [adminUserId]: new Date().toISOString() },
      })),
    );
    await Promise.all(ids.map((id) => fetch(`/api/admin/events/${id}/read`, { method: "POST" })));
  }

  // Affichage : 20 derniers events (lus + non lus), du plus récent au plus ancien.
  const visible = events.slice(0, 20);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`${unread.length} notifications non lues`}
        aria-expanded={open}
        className="relative rounded-md w-10 h-10 inline-flex items-center justify-center cursor-pointer"
        style={{
          background: open ? "var(--ivory)" : "var(--paper)",
          border: "1px solid var(--line)",
          color: "var(--ink-3)",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread.length > 0 && (
          <span
            className="absolute -top-1 -right-1 text-[10px] font-medium rounded-full min-w-5 h-5 px-1 inline-flex items-center justify-center"
            style={{ background: "var(--danger)", color: "var(--paper)", fontFamily: "var(--mono)" }}
          >
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 rounded-lg overflow-hidden z-50"
          style={{
            width: 360,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: 480,
            display: "flex",
            flexDirection: "column",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            boxShadow: "0 10px 38px -10px rgba(15,22,41,.22), 0 2px 8px -2px rgba(15,22,41,.12)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: "1px solid var(--line-2)" }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              Notifications
              {unread.length > 0 && (
                <span style={{ color: "var(--ink-5)", fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                  · {unread.length} non lu{unread.length > 1 ? "s" : ""}
                </span>
              )}
            </span>
            {unread.length > 0 && (
              <button
                onClick={markAll}
                className="text-xs cursor-pointer"
                style={{ color: "var(--accent)" }}
              >
                Tout marquer lu
              </button>
            )}
          </div>

          {/* List */}
          <ul className="overflow-auto" style={{ flex: 1 }}>
            {visible.length === 0 && (
              <li
                className="px-3 py-6 text-center text-xs"
                style={{ color: "var(--ink-5)" }}
              >
                Aucune notification pour le moment.
              </li>
            )}
            {visible.map((e) => {
              const tone = SEVERITY_STYLES[e.severity];
              const meta = EVENT_META[e.type] ?? null;
              const subLine = meta?.subLine?.(e) ?? null;
              const href = meta?.link?.(e) ?? null;
              const isUnread = !e.read_by?.[adminUserId];
              const time = new Date(e.created_at).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              });
              const inner = (
                <div
                  className="px-3 py-2.5"
                  style={{
                    borderLeft: `3px solid ${tone.borderColor}`,
                    background: isUnread ? tone.bg : "transparent",
                    cursor: href ? "pointer" : "default",
                  }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="flex items-center gap-1.5" style={{ color: "var(--ink)", fontSize: 13 }}>
                      {meta && <span aria-hidden style={{ fontSize: 14 }}>{meta.icon}</span>}
                      <strong style={{ fontWeight: isUnread ? 600 : 500 }}>
                        {meta?.label ?? e.type}
                      </strong>
                      {isUnread && (
                        <span
                          aria-hidden
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            background: "var(--danger)",
                            marginLeft: 4,
                          }}
                        />
                      )}
                    </span>
                    <span style={{ color: "var(--ink-5)", fontSize: 11, flexShrink: 0 }}>{time}</span>
                  </div>
                  {subLine && (
                    <div className="mt-1" style={{ color: "var(--ink-3)", fontSize: 12, lineHeight: 1.4 }}>
                      {subLine}
                    </div>
                  )}
                  {(() => {
                    const items = meta?.details?.(e);
                    if (!items || items.length === 0) return null;
                    return (
                      <ul
                        className="mt-1.5 space-y-0.5"
                        style={{
                          paddingLeft: 0,
                          listStyle: "none",
                          fontSize: 11,
                          color: "var(--ink-3)",
                        }}
                      >
                        {items.map((d, i) => (
                          <li
                            key={i}
                            className="flex justify-between gap-3"
                            style={{
                              padding: "2px 6px",
                              borderRadius: 3,
                              background: "rgba(15,22,41,0.03)",
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>{d.label}</span>
                            {d.value && (
                              <span
                                style={{
                                  fontFamily: "var(--mono)",
                                  color: "var(--ink-5)",
                                  flexShrink: 0,
                                }}
                              >
                                {d.value}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                  {!meta && Object.keys(e.payload).length > 0 && (
                    <pre
                      className="mt-1 truncate"
                      style={{ color: "var(--ink-4)", fontSize: 10 }}
                    >
                      {JSON.stringify(e.payload)}
                    </pre>
                  )}
                </div>
              );
              return (
                <li
                  key={e.id}
                  style={{ borderTop: "1px solid var(--line-2)" }}
                  onClick={() => {
                    if (isUnread) markOne(e.id);
                  }}
                >
                  {href ? (
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      style={{ textDecoration: "none", color: "inherit", display: "block" }}
                    >
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
