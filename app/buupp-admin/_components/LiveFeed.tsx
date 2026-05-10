"use client";
import { useEffect, useState } from "react";

type AdminEvent = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  payload: Record<string, unknown>;
  created_at: string;
};

const TONE: Record<string, string> = {
  info: "border-l-neutral-300 bg-white",
  warning: "border-l-amber-400 bg-amber-50",
  critical: "border-l-rose-500 bg-rose-50",
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
    <div className="rounded-lg border border-neutral-200 bg-white p-4 max-h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">Live feed</div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="text-xs border px-2 py-1 rounded">
          <option value="">Tout</option><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
        </select>
      </div>
      <ul className="space-y-1 overflow-auto">
        {visible.map((e) => (
          <li key={e.id} className={`border-l-4 ${TONE[e.severity]} px-2 py-1 text-xs`}>
            <div className="flex justify-between">
              <span className="font-mono">{e.type}</span>
              <span className="text-neutral-500">{new Date(e.created_at).toLocaleTimeString("fr-FR")}</span>
            </div>
            {Object.keys(e.payload).length > 0 && (
              <pre className="text-[10px] text-neutral-600 truncate">{JSON.stringify(e.payload)}</pre>
            )}
          </li>
        ))}
        {visible.length === 0 && <li className="text-xs text-neutral-500">Aucun event pour le moment.</li>}
      </ul>
    </div>
  );
}
