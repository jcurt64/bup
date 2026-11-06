"use client";

import { useEffect, useState } from "react";
import { StudyIcon, TYPE_THEME } from "./StudyIcons";

export const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";

/** Horloge partagée (null avant hydratation : pas d'écart serveur/client). */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [intervalMs]);
  return now;
}

const BADGE_COLORS: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#EEF2FF", fg: "#4338CA" },
  remaining: { bg: "#FEF3C7", fg: "#B45309" },
  validated: { bg: "#DCFCE7", fg: "#15803D" },
  full: { bg: "#E0E7FF", fg: "#3730A3" },
  canceled: { bg: "#FEE2E2", fg: "#B91C1C" },
  closed: { bg: "#F1F5F9", fg: "#475569" },
  draft: { bg: "#F1F5F9", fg: "#475569" },
};

export function Badge({ k, label, floating = false }: { k: string; label: string; floating?: boolean }) {
  const c = BADGE_COLORS[k] ?? BADGE_COLORS.closed;
  return (
    <span className={floating ? "st-badge" : undefined}
      style={floating ? { color: c.fg } : {
        display: "inline-block", padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700,
        background: c.bg, color: c.fg, whiteSpace: "nowrap",
      }}>
      {label}
    </span>
  );
}

/** Jauge inscrits → seuil → maximum, colorée selon le type. */
export function Gauge({ joined, min, max, type }: { joined: number; min: number; max: number; type?: string }) {
  const t = TYPE_THEME[type ?? "survey"] ?? TYPE_THEME.survey;
  const pct = Math.min(100, (joined / Math.max(1, max)) * 100);
  const reached = joined >= min;
  return (
    <div aria-label={`${joined} inscrits sur ${max}, seuil ${min}`}>
      <div className="st-gauge-track">
        <div className="st-gauge-fill" style={{
          width: `${Math.max(pct, joined > 0 ? 3 : 0)}%`,
          background: reached ? "linear-gradient(90deg, #16A34A, #4ADE80)" : `linear-gradient(90deg, ${t.from}, ${t.to})`,
        }} />
        <div className="st-gauge-min" title={`Seuil : ${min} participants`} style={{ left: `calc(${(min / Math.max(1, max)) * 100}% - 1px)` }} />
      </div>
      <div className="st-gauge-legend">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <StudyIcon name="users" size={14} />
          <strong style={{ color: "var(--ink)" }}>{joined}</strong>&nbsp;inscrit{joined > 1 ? "s" : ""}
        </span>
        <span>seuil <strong style={{ color: "var(--ink)" }}>{min}</strong> · max {max}</span>
      </div>
    </div>
  );
}

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n: number) => String(n).padStart(2, "0");

/** Compte à rebours en direct (j / h / min / s), rouge dans les dernières 24 h. */
export function LiveCountdown({ to, label, now }: { to: string; label: string; now: number | null }) {
  const left = now === null ? null : new Date(to).getTime() - now;
  const u = left === null ? null : split(left);
  const units: [string, string][] = u
    ? (u.d > 0 ? [[String(u.d), "j"], [pad(u.h), "h"], [pad(u.m), "min"], [pad(u.s), "s"]] : [[pad(u.h), "h"], [pad(u.m), "min"], [pad(u.s), "s"]])
    : [["–", "j"], ["–", "h"], ["–", "min"], ["–", "s"]];
  return (
    <div className="st-cd" data-urgent={left !== null && left > 0 && left < 864e5}>
      <span className="st-cd-label"><StudyIcon name="timer" size={14} />{left !== null && left <= 0 ? "Terminé" : label}</span>
      <span className="st-cd-units" aria-live="off">
        {units.map(([v, l]) => (<span key={l} className="st-cd-unit"><b>{v}</b><small>{l}</small></span>))}
      </span>
    </div>
  );
}

/** Ancienne API (fiche) : texte court. */
export function Countdown({ to, label }: { to: string; label: string }) {
  const now = useNow(30_000);
  const ms = now === null ? null : new Date(to).getTime() - now;
  const u = ms === null ? null : split(ms);
  const txt = u === null ? "…" : ms! <= 0 ? "terminé" : u.d > 0 ? `${u.d} j ${u.h} h` : u.h > 0 ? `${u.h} h ${u.m} min` : `${u.m} min`;
  return <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{label} : <strong>{txt}</strong></span>;
}
