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
    <button
      onClick={markAll}
      aria-label={`${unread.length} notifications non lues`}
      className="relative rounded-md w-10 h-10 inline-flex items-center justify-center cursor-pointer"
      style={{
        background: "var(--paper)",
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
  );
}
