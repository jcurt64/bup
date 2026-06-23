"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { EVENT_META, type AdminEventLike } from "./eventMeta";
import AdminIcon, { type AdminIconName } from "./AdminIcon";

type AdminEvent = AdminEventLike;

// Teinte de la pastille d'icône + fond de la ligne selon la sévérité.
// `critical` colore tout le bloc en rouge tendre (cf. maquette da.png).
const TONE: Record<
  AdminEvent["severity"],
  { color: string; chipBg: string; rowBg: string; rowBorder: string }
> = {
  info: {
    color: "var(--good)",
    chipBg: "color-mix(in oklab, var(--good) 13%, var(--paper))",
    rowBg: "transparent",
    rowBorder: "transparent",
  },
  warning: {
    color: "var(--warn)",
    chipBg: "color-mix(in oklab, var(--warn) 14%, var(--paper))",
    rowBg: "color-mix(in oklab, var(--warn) 7%, var(--paper))",
    rowBorder: "color-mix(in oklab, var(--warn) 22%, var(--line))",
  },
  critical: {
    color: "var(--danger)",
    chipBg: "color-mix(in oklab, var(--danger) 13%, var(--paper))",
    rowBg: "color-mix(in oklab, var(--danger) 8%, var(--paper))",
    rowBorder: "color-mix(in oklab, var(--danger) 25%, var(--line))",
  },
};

// Icône par défaut selon la sévérité (quand l'event n'a pas de feedIcon).
const SEVERITY_ICON: Record<AdminEvent["severity"], AdminIconName> = {
  info: "check",
  warning: "alert-triangle",
  critical: "alert-triangle",
};

// Horodatage relatif « il y a X min / h / j » (style maquette).
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function LiveFeed() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [filter, setFilter] = useState<string>("");
  // Force un re-render périodique pour rafraîchir les horodatages relatifs.
  const [, setTick] = useState(0);

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
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      // Laisser EventSource gérer la reconnexion auto.
    };
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => {
      es.close();
      clearInterval(t);
    };
  }, []);

  const FILTERS: { value: string; label: string }[] = [
    { value: "", label: "Tout" },
    { value: "info", label: "Infos" },
    { value: "warning", label: "Alertes" },
    { value: "critical", label: "Critiques" },
  ];

  const visible = filter ? events.filter((e) => e.severity === filter) : events;

  return (
    <div
      className="rounded-xl p-4 max-h-[760px] flex flex-col"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      {/* En-tête : pastille verte clignotante + LIVE FEED + filtre « Tout » */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="relative inline-flex"
            style={{ width: 8, height: 8 }}
            aria-hidden
          >
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "var(--good)", opacity: 0.5 }}
            />
            <span
              className="relative rounded-full"
              style={{ width: 8, height: 8, background: "var(--good)" }}
            />
          </span>
          <span
            className="text-[11px] font-bold uppercase"
            style={{ color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.1em" }}
          >
            Live feed
          </span>
        </div>
        <div
          className="flex items-center gap-0.5 rounded-full p-0.5"
          style={{ background: "var(--ivory-2)", border: "1px solid var(--line)" }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className="text-[11px] font-medium rounded-full px-2.5 py-1 cursor-pointer transition-colors"
                style={
                  active
                    ? { background: "var(--ink)", color: "var(--paper)" }
                    : { background: "transparent", color: "var(--ink-4)" }
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="space-y-1 overflow-auto pr-0.5">
        {visible.map((e) => {
          const tone = TONE[e.severity];
          const meta = EVENT_META[e.type] ?? null;
          const subLine = meta?.subLine?.(e) ?? null;
          const href = meta?.link?.(e) ?? null;
          const iconName = meta?.feedIcon ?? SEVERITY_ICON[e.severity];
          const time = relativeTime(e.created_at);

          const inner = (
            <div
              className="flex items-start gap-2.5 px-2 py-2 rounded-lg transition-colors"
              style={{
                background: tone.rowBg,
                border: `1px solid ${tone.rowBorder}`,
              }}
            >
              <span
                className="inline-flex items-center justify-center rounded-lg shrink-0 mt-0.5"
                style={{ width: 30, height: 30, background: tone.chipBg, color: tone.color }}
              >
                <AdminIcon name={iconName} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="font-semibold truncate"
                    style={{ color: "var(--ink)", fontSize: 13 }}
                  >
                    {meta?.label ?? e.type}
                  </span>
                  <span
                    className="shrink-0 whitespace-nowrap"
                    style={{ color: "var(--ink-5)", fontSize: 11 }}
                  >
                    {time}
                  </span>
                </div>
                {subLine && (
                  <div
                    className="mt-0.5 truncate"
                    style={{ color: "var(--ink-3)", fontSize: 12, lineHeight: 1.4 }}
                  >
                    {subLine}
                  </div>
                )}
                {(() => {
                  const items = meta?.details?.(e);
                  if (!items || items.length === 0) return null;
                  return (
                    <ul className="mt-1.5 space-y-0.5" style={{ listStyle: "none", padding: 0 }}>
                      {items.map((d, i) => (
                        <li
                          key={i}
                          className="flex justify-between gap-3"
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "rgba(15,22,41,0.03)",
                            fontSize: 11,
                            color: "var(--ink-3)",
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
                    className="mt-0.5 truncate"
                    style={{ color: "var(--ink-4)", fontSize: 10 }}
                  >
                    {JSON.stringify(e.payload)}
                  </pre>
                )}
              </div>
            </div>
          );

          return (
            <li key={e.id}>
              {href ? (
                <Link
                  href={href}
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
        {visible.length === 0 && (
          <li className="text-xs py-6 text-center" style={{ color: "var(--ink-5)" }}>
            Aucun event pour le moment.
          </li>
        )}
      </ul>
    </div>
  );
}
