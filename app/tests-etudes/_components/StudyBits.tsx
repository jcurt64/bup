"use client";

import { useEffect, useState } from "react";

export const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";

const BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  open: { bg: "var(--accent-soft, #EEF2FF)", fg: "var(--accent, #4F46E5)" },
  remaining: { bg: "#FEF3C7", fg: "#B45309" },
  validated: { bg: "#DCFCE7", fg: "#15803D" },
  full: { bg: "#E0E7FF", fg: "#3730A3" },
  canceled: { bg: "#FEE2E2", fg: "#B91C1C" },
  closed: { bg: "#F1F5F9", fg: "#475569" },
  draft: { bg: "#F1F5F9", fg: "#475569" },
};

export function Badge({ k, label }: { k: string; label: string }) {
  const c = BADGE_COLORS[k] ?? BADGE_COLORS.closed;
  return (
    <span
      style={{
        display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12,
        fontWeight: 600, background: c.bg, color: c.fg, whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/** Jauge inscrits → seuil → maximum. */
export function Gauge({ joined, min, max }: { joined: number; min: number; max: number }) {
  const pct = Math.min(100, (joined / max) * 100);
  const minPct = (min / max) * 100;
  return (
    <div aria-label={`${joined} inscrits sur ${max}, seuil ${min}`}>
      <div style={{ position: "relative", height: 10, borderRadius: 999, background: "var(--ivory-2, #F1EDE2)" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: joined >= min ? "#15803D" : "var(--accent, #4F46E5)" }} />
        <div title="Seuil minimum" style={{ position: "absolute", left: `${minPct}%`, top: -3, width: 2, height: 16, background: "var(--ink, #0F172A)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-4, #64748B)", marginTop: 6 }}>
        <span><strong style={{ color: "var(--ink)" }}>{joined}</strong> inscrit{joined > 1 ? "s" : ""}</span>
        <span>seuil {min} · max {max}</span>
      </div>
    </div>
  );
}

function fmtLeft(ms: number): string {
  if (ms <= 0) return "terminé";
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  return d > 0 ? `${d} j ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function Countdown({ to, label }: { to: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  return (
    <span style={{ fontSize: 13, color: "var(--ink-3, #334155)" }}>
      {label} : <strong>{now === null ? "…" : fmtLeft(new Date(to).getTime() - now)}</strong>
    </span>
  );
}
