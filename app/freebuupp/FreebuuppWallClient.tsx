"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Ongoing = {
  code: string;
  title: string;
  prizeDescription: string;
  brandName: string;
  panelSize: number;
  winnersCount: number;
  geo: string;
  closesAt: string;
  participantCount: number;
  placesLeft: number;
};
type Past = {
  code: string;
  title: string;
  prizeDescription: string;
  brandName: string;
  panelSize: number;
  winnersCount: number;
  geo: string;
  drawnAt: string | null;
  participantCount: number;
};

function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Clôturé";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function FreebuuppWallClient() {
  const [data, setData] = useState<{ ongoing: Ongoing[]; past: Past[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/freebuupps", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { ongoing: [], past: [] }))
      .then((j) => {
        if (!cancelled) setData({ ongoing: j.ongoing ?? [], past: j.past ?? [] });
      })
      .catch(() => {
        if (!cancelled) setData({ ongoing: [], past: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <div className="card" style={{ padding: 24 }}>Chargement…</div>;

  const empty = data.ongoing.length === 0 && data.past.length === 0;
  if (empty) {
    return (
      <div className="card" style={{ padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🎁</div>
        <strong>Aucun FREEBUUPP pour le moment.</strong>
        <p style={{ color: "var(--ink-3)", margin: "8px 0 0" }}>
          Revenez bientôt — de nouveaux tirages arrivent régulièrement.
        </p>
      </div>
    );
  }

  return (
    <div className="col gap-6">
      {data.ongoing.length > 0 && (
        <section>
          <h2 className="mono caps" style={{ color: "var(--ink-4)", fontSize: 13, margin: "0 0 12px" }}>
            En cours · {data.ongoing.length}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {data.ongoing.map((f) => (
              <Link key={f.code} href={`/freebuupp/${f.code}`} className="card" style={{ padding: 20, textDecoration: "none", color: "inherit", display: "block" }}>
                <div className="mono caps" style={{ color: "var(--ink-4)", fontSize: 11 }}>{f.brandName}</div>
                <div className="serif" style={{ fontSize: 20, margin: "4px 0 8px" }}>{f.title}</div>
                <div style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 12 }}>🎁 {f.prizeDescription}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ink-4)" }}>
                  <span>⏳ {countdown(f.closesAt)}</span>
                  <span>{f.placesLeft} places · {f.winnersCount} à gagner au tirage</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.past.length > 0 && (
        <section>
          <h2 className="mono caps" style={{ color: "var(--ink-4)", fontSize: 13, margin: "0 0 12px" }}>
            Tirages effectués · {data.past.length}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {data.past.map((f) => (
              <Link key={f.code} href={`/freebuupp/${f.code}`} className="card" style={{ padding: 20, textDecoration: "none", color: "inherit", display: "block", opacity: 0.92 }}>
                <div className="mono caps" style={{ color: "var(--ink-4)", fontSize: 11 }}>{f.brandName}</div>
                <div className="serif" style={{ fontSize: 20, margin: "4px 0 8px" }}>{f.title}</div>
                <div style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 12 }}>🎁 {f.prizeDescription}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ink-4)" }}>
                  <span>🔒 Tirage vérifié</span>
                  <span>{f.participantCount} participants · {f.winnersCount} gagnants</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
