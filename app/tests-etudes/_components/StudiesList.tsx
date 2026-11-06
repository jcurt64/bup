"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Countdown, Gauge, euro } from "./StudyBits";

type Item = {
  id: string; typeLabel: string; title: string; rewardCents: number; zone: string; proName: string;
  joinedCount: number; min: number; max: number; remainingPlaces: number; status: string;
  signupDeadline: string; completionDeadline: string; badge: { key: string; label: string }; paidMention: string;
  estimatedMinutes: number;
};

const TYPES = [
  ["", "Tous les types"],
  ["survey", "Sondage en ligne"],
  ["product_test", "Test d'un site ou d'une appli"],
  ["visit", "Visite / rendez-vous"],
] as const;

export default function StudiesList() {
  const [department, setDepartment] = useState("");
  const [type, setType] = useState("");
  const [minReward, setMinReward] = useState("");
  const [deadline, setDeadline] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    const q = new URLSearchParams();
    if (department.trim()) q.set("department", department.trim());
    if (type) q.set("type", type);
    if (minReward) q.set("minReward", minReward);
    if (deadline) q.set("deadlineBefore", new Date(deadline + "T23:59:59").toISOString());
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/studies?${q}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d) => setItems(d.items ?? []))
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [department, type, minReward, deadline]);

  const field: React.CSSProperties = { minWidth: 0, width: "100%" };
  return (
    <div>
      <div
        className="card"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, padding: 16, marginBottom: 24 }}
      >
        <label className="col gap-1" style={{ fontSize: 13 }}>
          Département
          <input className="input" style={field} placeholder="ex. 64" maxLength={3} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </label>
        <label className="col gap-1" style={{ fontSize: 13 }}>
          Type
          <select className="input" style={field} value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="col gap-1" style={{ fontSize: 13 }}>
          Rémunération min. (€)
          <input className="input" style={field} type="number" min={0} step={1} value={minReward} onChange={(e) => setMinReward(e.target.value)} />
        </label>
        <label className="col gap-1" style={{ fontSize: 13 }}>
          Inscriptions avant le
          <input className="input" style={field} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
      </div>

      {items === null ? (
        <p style={{ color: "var(--ink-4)" }}>Chargement…</p>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: "center", color: "var(--ink-3)" }}>
          Aucune campagne ne correspond pour le moment. Revenez bientôt !
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {items.map((i) => (
            <Link key={i.id} href={`/tests-etudes/${i.id}`} className="card" style={{ padding: 20, textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <span className="mono caps" style={{ fontSize: 11, color: "var(--ink-4)" }}>{i.typeLabel}</span>
                <Badge k={i.badge.key} label={i.badge.label} />
              </div>
              <div>
                <div className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>{i.title}</div>
                <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>{i.proName} · {i.zone} · ~{i.estimatedMinutes} min</div>
              </div>
              <div className="serif" style={{ fontSize: 28, color: "var(--accent)" }}>{euro(i.rewardCents)}</div>
              <Gauge joined={i.joinedCount} min={i.min} max={i.max} />
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                {i.status === "published"
                  ? <Countdown to={i.signupDeadline} label="Inscriptions" />
                  : <Countdown to={i.completionDeadline} label="Réalisation" />}
                <span style={{ fontSize: 13, color: "var(--ink-4)" }}>{i.remainingPlaces} place{i.remainingPlaces > 1 ? "s" : ""}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{i.paidMention}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
