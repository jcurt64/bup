"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, Gauge, LiveCountdown, euro, useNow } from "./StudyBits";
import { StudyIcon, TYPE_THEME, type StudyIconName } from "./StudyIcons";
import ComingSoonArt from "./ComingSoonArt";

type Item = {
  id: string; type: string; typeLabel: string; title: string; rewardCents: number; zone: string; proName: string;
  joinedCount: number; min: number; max: number; remainingPlaces: number; status: string;
  signupDeadline: string; completionDeadline: string; badge: { key: string; label: string }; paidMention: string;
  estimatedMinutes: number;
};

/** Cartes de chiffres du héros (campagnes ouvertes, places, meilleure
 *  rémunération) : masquées tant que le catalogue est encore peu fourni.
 *  Passer à `true` pour les réafficher. */
const SHOW_HERO_STATS = false;

const TYPES: { v: string; l: string; icon: StudyIconName }[] = [
  { v: "", l: "Toutes", icon: "sparkles" },
  { v: "survey", l: "Sondages", icon: "survey" },
  { v: "product_test", l: "Tests de site / appli", icon: "product_test" },
  { v: "visit", l: "Visites & rendez-vous", icon: "visit" },
];

const initials = (s: string) => s.replace(/\[.*?\]\s*/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "P";

function StudyCard({ i, now }: { i: Item; now: number | null }) {
  const router = useRouter();
  const t = TYPE_THEME[i.type] ?? TYPE_THEME.survey;
  const open = i.status === "published" && i.remainingPlaces > 0;
  const href = `/tests-etudes/${i.id}`;
  const share = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${href}`;
    const remaining = Math.max(0, i.min - i.joinedCount);
    const text = remaining > 0 ? `Plus que ${remaining} participant${remaining > 1 ? "s" : ""} pour lancer « ${i.title} » — ${euro(i.rewardCents)} via BUUPP` : `« ${i.title} » — ${euro(i.rewardCents)} via BUUPP`;
    try { if (navigator.share) await navigator.share({ title: i.title, text, url }); else await navigator.clipboard.writeText(`${text} ${url}`); } catch { /* annulé */ }
  };
  return (
    <article className="st-card" onClick={() => router.push(href)} role="link" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(href); }} aria-label={i.title}>
      <div className="st-card-top" style={{ background: `linear-gradient(125deg, ${t.from}, ${t.to})` }}>
        <span className="st-type"><span className="st-type-ic"><StudyIcon name={i.type as StudyIconName} size={18} /></span>{t.label}</span>
        <Badge k={i.badge.key} label={i.badge.label} floating />
        <div className="st-reward"><span className="st-reward-v">{euro(i.rewardCents)}</span><span className="st-reward-l">par participant</span></div>
      </div>
      <div className="st-card-body">
        <div className="st-card-title">{i.title}</div>
        <div className="st-meta">
          <span><StudyIcon name="pin" size={14} />{i.zone}</span>
          <span><StudyIcon name="clock" size={14} />~{i.estimatedMinutes} min</span>
          <span><StudyIcon name="target" size={14} />{i.remainingPlaces} place{i.remainingPlaces > 1 ? "s" : ""}</span>
        </div>
        <Gauge joined={i.joinedCount} min={i.min} max={i.max} type={i.type} />
        {i.status === "published"
          ? <LiveCountdown to={i.signupDeadline} label="Pour participer" now={now} />
          : <LiveCountdown to={i.completionDeadline} label="Réalisation" now={now} />}
        <div className="st-pro">
          <span className="st-avatar" style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}>{initials(i.proName)}</span>
          <span>Proposé par <strong style={{ color: "var(--ink)" }}>{i.proName}</strong></span>
        </div>
        <div className="st-actions">
          <a className="st-cta" href={open ? `${href}?participer=1` : href} aria-disabled={!open}
            onClick={(e) => e.stopPropagation()}
            style={{ background: `linear-gradient(110deg, ${t.from}, ${t.to})` }}>
            {open ? <>Je participe <StudyIcon name="arrow" size={16} /></> : i.status === "validated" ? "Inscriptions closes" : "Complète"}
          </a>
          <button className="st-ghost" onClick={share} aria-label="Partager la campagne" title="Partager"><StudyIcon name="share" size={18} /></button>
        </div>
        <div className="st-mention"><StudyIcon name="shield" size={13} />{i.paidMention}</div>
      </div>
    </article>
  );
}

export default function StudiesList() {
  const [department, setDepartment] = useState("");
  const [type, setType] = useState("");
  const [minReward, setMinReward] = useState("");
  const [deadline, setDeadline] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const now = useNow(1000);

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

  const stats = useMemo(() => {
    const open = (items ?? []).filter((i) => i.status === "published");
    return {
      open: open.length,
      places: open.reduce((s, i) => s + i.remainingPlaces, 0),
      best: open.reduce((m, i) => Math.max(m, i.rewardCents), 0),
    };
  }, [items]);

  return (
    <>
      <section className="st-hero" data-nav-theme="dark">
        <div className="st-hero-glow" aria-hidden />
        <div className="st-hero-inner">
          <span className="st-eyebrow"><span className="dot" />Tests &amp; Études · participations rémunérées</span>
          <h1 className="serif st-title">Votre avis compte pour les professionnels.<br /><em>Ils vous payent.</em></h1>
          <p className="st-lead">
            Des professionnels cherchent des participants pour un sondage, le test de leur site ou de leur appli, ou une visite
            en magasin. Inscrivez-vous, réalisez la tâche, encaissez dans votre portefeuille BUUPP.
          </p>
          {SHOW_HERO_STATS && (
          <div className="st-stats">
            <div className="st-stat"><div className="st-stat-v">{items ? stats.open : "–"}</div><div className="st-stat-l">campagnes ouvertes</div></div>
            <div className="st-stat"><div className="st-stat-v">{items ? stats.places : "–"}</div><div className="st-stat-l">places disponibles</div></div>
            <div className="st-stat"><div className="st-stat-v">{items && stats.best ? euro(stats.best) : "–"}</div><div className="st-stat-l">meilleure rémunération</div></div>
          </div>
          )}
          <div className="st-steps">
            {([
              ["target", "Choisissez une campagne et inscrivez-vous en un clic.", "#6366F1", "#A855F7"],
              ["check", "Seuil atteint : recevez votre code et réalisez la tâche.", "#0EA5E9", "#14B8A6"],
              ["wallet", "Validé sous 7 jours, crédité dans votre portefeuille.", "#F97316", "#F43F5E"],
            ] as [StudyIconName, string, string, string][]).map(([ic, txt, a, b], k) => (
              <div key={k} className="st-step">
                <span className="st-step-ic" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}><StudyIcon name={ic} size={20} /></span>
                <span><strong style={{ color: "#fff" }}>{k + 1}.</strong> {txt}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="st-body">
        <div className="st-filters">
          <label className="st-field">Département
            <span className="st-field-box"><StudyIcon name="pin" size={16} />
              <input placeholder="ex. 64, 2A, 974" maxLength={3} value={department} onChange={(e) => setDepartment(e.target.value)} />
            </span>
          </label>
          <label className="st-field">Type de campagne
            <span className="st-field-box"><StudyIcon name="filter" size={16} />
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((x) => <option key={x.v} value={x.v}>{x.v ? x.l : "Tous les types"}</option>)}
              </select>
            </span>
          </label>
          <label className="st-field">Rémunération min.
            <span className="st-field-box"><StudyIcon name="euro" size={16} />
              <input type="number" min={0} step={1} placeholder="0" value={minReward} onChange={(e) => setMinReward(e.target.value)} />
            </span>
          </label>
          <label className="st-field">Inscriptions avant le
            <span className="st-field-box"><StudyIcon name="clock" size={16} />
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </span>
          </label>
        </div>

        <div className="st-types" role="tablist" aria-label="Filtrer par type">
          {TYPES.map((x) => {
            const th = TYPE_THEME[x.v];
            const on = type === x.v;
            return (
              <button key={x.v} className="st-chip" data-on={on} role="tab" aria-selected={on} onClick={() => setType(x.v)}
                style={on ? { background: th ? `linear-gradient(110deg, ${th.from}, ${th.to})` : "#0F1629" } : undefined}>
                <StudyIcon name={x.icon} size={16} />{x.l}
              </button>
            );
          })}
        </div>

        {items === null ? (
          <div className="st-grid">{[0, 1, 2].map((k) => <div key={k} className="st-skel" />)}</div>
        ) : items.length === 0 ? (
          <div className="st-empty">
            <ComingSoonArt />
            {department || type || minReward || deadline ? (
              <>
                <div className="serif" style={{ fontSize: 26, marginBottom: 6 }}>Aucune campagne pour ces critères</div>
                <p style={{ color: "var(--ink-4)", maxWidth: 460, margin: "0 auto" }}>Élargissez vos filtres : de nouvelles campagnes sont publiées régulièrement.</p>
              </>
            ) : (
              <>
                <div className="serif" style={{ fontSize: 28, marginBottom: 6 }}>Les premières campagnes arrivent bientôt</div>
                <p style={{ color: "var(--ink-4)", maxWidth: 460, margin: "0 auto" }}>
                  Des professionnels préparent leurs sondages, tests et visites. Revenez très vite : les places sont limitées et partent aux premiers inscrits.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="st-count">{items.length} campagne{items.length > 1 ? "s" : ""}</div>
            <div className="st-grid">{items.map((i) => <StudyCard key={i.id} i={i} now={now} />)}</div>
          </>
        )}

        <div className="st-trust">
          {([
            ["lock", "Données protégées", "Seuls votre prénom et un alias e-mail sont transmis, et uniquement si la campagne est lancée.", "#EEF2FF", "#4338CA"],
            ["shield", "Tout ou rien", "Pas assez de participants ? La campagne est annulée et votre inscription supprimée.", "#ECFEFF", "#0E7490"],
            ["wallet", "Paiement garanti", "Le budget est réservé par le professionnel dès la publication. Sans réponse de sa part sous 7 jours, vous êtes payé.", "#FFF7ED", "#C2410C"],
          ] as [StudyIconName, string, string, string, string][]).map(([ic, h, p, bg, fg]) => (
            <div key={h} className="st-trust-item">
              <span className="st-trust-ic" style={{ background: bg, color: fg }}><StudyIcon name={ic} size={22} /></span>
              <div><div style={{ fontWeight: 700, marginBottom: 4 }}>{h}</div><div style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.5 }}>{p}</div></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
