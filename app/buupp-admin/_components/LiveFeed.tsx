"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { EVENT_META, type AdminEventLike } from "./eventMeta";

type AdminEvent = AdminEventLike;

const SEVERITY_STYLES: Record<AdminEvent["severity"], { borderColor: string; bg: string }> = {
  info: { borderColor: "var(--line-2)", bg: "var(--paper)" },
  warning: { borderColor: "var(--warn)", bg: "rgba(180, 83, 9, 0.06)" },
  critical: { borderColor: "var(--danger)", bg: "rgba(185, 28, 28, 0.06)" },
};

export default function LiveFeed() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    const es = new EventSource("/api/admin/events/stream");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type !== "event") return;
        // Dédup par id : à chaque (re)connexion du SSE, le serveur
        // renvoie le backlog des 10 derniers events → sans guard, on
        // duplique et React crashe avec "duplicate keys".
        setEvents((cur) => {
          if (cur.some((e) => e.id === msg.payload.id)) return cur;
          return [msg.payload, ...cur].slice(0, 200);
        });
      } catch { /* ignore */ }
    };
    es.onerror = () => {
      // Laisser EventSource gérer la reconnexion auto.
    };
    return () => es.close();
  }, []);

  const visible = filter ? events.filter((e) => e.severity === filter) : events;

  return (
    <div
      className="rounded-lg p-4 max-h-[600px] flex flex-col"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="text-[11px] uppercase"
          style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
        >
          Live feed
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="admin-select text-xs rounded px-2 py-1 cursor-pointer"
          style={{ background: "var(--ivory)", color: "var(--ink-3)", border: "1px solid var(--line)" }}
        >
          <option value="">Tout</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </div>
      <ul className="space-y-1.5 overflow-auto">
        {visible.map((e) => {
          const tone = SEVERITY_STYLES[e.severity];
          const meta = EVENT_META[e.type] ?? null;
          const subLine = meta?.subLine?.(e) ?? null;
          const href = meta?.link?.(e) ?? null;
          const time = new Date(e.created_at).toLocaleTimeString("fr-FR");
          return (
            <li
              key={e.id}
              className="px-2 py-1.5 text-xs rounded"
              style={{
                borderLeft: `3px solid ${tone.borderColor}`,
                background: tone.bg,
              }}
            >
              {meta ? (
                /* Rendu humain pour les types connus. */
                <>
                  <div className="flex justify-between items-start gap-2">
                    <span className="flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                      <span aria-hidden style={{ fontSize: 13 }}>{meta.icon}</span>
                      <strong style={{ fontWeight: 600 }}>{meta.label}</strong>
                    </span>
                    <span style={{ color: "var(--ink-5)", flexShrink: 0 }}>{time}</span>
                  </div>
                  {subLine && (
                    <div className="mt-0.5" style={{ color: "var(--ink-3)", lineHeight: 1.4 }}>
                      {subLine}
                    </div>
                  )}
                  {(() => {
                    const items = meta.details?.(e);
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
                  {(href || e.prospect_id) && (
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {href && (
                        <Link
                          href={href}
                          className="underline"
                          style={{ color: "var(--accent)", fontSize: 11 }}
                        >
                          Ouvrir →
                        </Link>
                      )}
                      {e.prospect_id && (
                        <span
                          title={e.prospect_id}
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 10,
                            color: "var(--ink-5)",
                            padding: "1px 5px",
                            borderRadius: 4,
                            background: "rgba(15, 22, 41, 0.04)",
                          }}
                        >
                          prospect: {e.prospect_id.slice(0, 8)}…
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Fallback brut pour les types non encore mappés. */
                <>
                  <div className="flex justify-between gap-2">
                    <span style={{ fontFamily: "var(--mono)", color: "var(--ink)" }}>{e.type}</span>
                    <span style={{ color: "var(--ink-5)" }}>{time}</span>
                  </div>
                  {Object.keys(e.payload).length > 0 && (
                    <pre className="text-[10px] mt-0.5 truncate" style={{ color: "var(--ink-4)" }}>
                      {JSON.stringify(e.payload)}
                    </pre>
                  )}
                </>
              )}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="text-xs" style={{ color: "var(--ink-5)" }}>
            Aucun event pour le moment.
          </li>
        )}
      </ul>
    </div>
  );
}
