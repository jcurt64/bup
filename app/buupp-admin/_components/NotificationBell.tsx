"use client";
import { useEffect, useState } from "react";

type AdminEvent = {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  read_by: Record<string, string>;
  created_at: string;
};

export default function NotificationBell({ adminUserId }: { adminUserId: string }) {
  const [events, setEvents] = useState<AdminEvent[]>([]);

  useEffect(() => {
    fetch("/api/admin/events?limit=100").then((r) => r.json()).then((d) => setEvents(d.events ?? []));
    const es = new EventSource("/api/admin/events/stream");
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "event") setEvents((cur) => [msg.payload, ...cur].slice(0, 200));
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, []);

  const unread = events.filter((e) => !e.read_by?.[adminUserId]);

  async function markAll() {
    await Promise.all(unread.map((e) => fetch(`/api/admin/events/${e.id}/read`, { method: "POST" })));
    setEvents((cur) =>
      cur.map((e) => ({ ...e, read_by: { ...(e.read_by || {}), [adminUserId]: new Date().toISOString() } })));
  }

  return (
    <div className="relative">
      <button onClick={markAll} className="relative px-3 py-1.5 rounded border border-neutral-300 text-sm bg-white">
        🔔 {unread.length > 0 && <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-xs rounded-full w-5 h-5 grid place-items-center">{unread.length}</span>}
      </button>
    </div>
  );
}
