"use client";
import { useEffect, useState } from "react";

type AdminEvent = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  payload: Record<string, unknown>;
  created_at: string;
};

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
        if (msg.type === "event") {
          setEvents((cur) => [msg.payload, ...cur].slice(0, 200));
        }
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
          className="text-xs rounded px-2 py-1 cursor-pointer"
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
          return (
            <li
              key={e.id}
              className="px-2 py-1.5 text-xs rounded"
              style={{
                borderLeft: `3px solid ${tone.borderColor}`,
                background: tone.bg,
              }}
            >
              <div className="flex justify-between gap-2">
                <span style={{ fontFamily: "var(--mono)", color: "var(--ink)" }}>{e.type}</span>
                <span style={{ color: "var(--ink-5)" }}>
                  {new Date(e.created_at).toLocaleTimeString("fr-FR")}
                </span>
              </div>
              {Object.keys(e.payload).length > 0 && (
                <pre className="text-[10px] mt-0.5 truncate" style={{ color: "var(--ink-4)" }}>
                  {JSON.stringify(e.payload)}
                </pre>
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
