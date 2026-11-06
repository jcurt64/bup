"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicStudy } from "@/lib/studies/repo";
import { REPORT_REASONS } from "@/lib/studies/constants";
import { Badge, Countdown, Gauge, euro } from "./StudyBits";

type Me =
  | null
  | { role: "other" }
  | {
      role: "prospect";
      eligibleZone: boolean;
      tier1Complete: boolean;
      reported: boolean;
      participation: { id: string; status: string; code: string | null; rejected_at: string | null; reject_reason: string | null } | null;
      access: { externalUrl: string | null; address: string | null } | null;
    };

const ERRORS: Record<string, string> = {
  tier1_incomplete: "Complétez d'abord votre prénom et votre e-mail (palier 1) dans « Mes données ».",
  out_of_area: "Cette campagne est réservée à un autre département que le vôtre.",
  full: "La campagne est complète.",
  not_open: "Les inscriptions sont fermées.",
  consent_required: "Vous devez cocher la case de consentement.",
  not_prospect: "Seuls les comptes particuliers peuvent participer.",
  already_reported: "Vous avez déjà signalé cette campagne.",
};

const PART_LABEL: Record<string, string> = {
  joined: "Inscrit — en attente du seuil",
  confirmed: "Validée — à réaliser",
  done: "Terminée — en attente de validation",
  approved: "Validée et payée",
  rejected: "Refusée — contestable 7 jours",
  disputed: "Contestation en cours",
  rejected_final: "Refusée",
  not_done: "Non réalisée",
};

export default function StudyDetail({ initial }: { initial: PublicStudy }) {
  const [s, setS] = useState(initial);
  const [me, setMe] = useState<Me>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("scam");
  const [reportNote, setReportNote] = useState("");
  const [doneComment, setDoneComment] = useState("");
  const [disputeNote, setDisputeNote] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/studies/${initial.id}`, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setS(d.study);
    setMe(d.me);
  }, [initial.id]);
  useEffect(() => { void load(); }, [load]);

  async function act(path: string, body: Record<string, unknown> = {}, okText = "C'est fait.") {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/studies/${s.id}/${path}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) {
        window.location.href = `/connexion?redirect_url=${encodeURIComponent(`/tests-etudes/${s.id}`)}`;
        return;
      }
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: ERRORS[d.error] ?? "Une erreur est survenue, réessayez." });
      if (r.ok) { setShowJoin(false); setShowReport(false); }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const remaining = Math.max(0, s.min - s.joinedCount);
    const text = remaining > 0
      ? `Plus que ${remaining} participant${remaining > 1 ? "s" : ""} pour lancer « ${s.title} » — ${euro(s.rewardCents)} via BUUPP`
      : `« ${s.title} » — ${euro(s.rewardCents)} via BUUPP`;
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: s.title, text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setMsg({ ok: true, text: "Lien copié." });
    } catch { /* partage annulé */ }
  }

  const p = me && me.role === "prospect" ? me.participation : null;
  const loggedOut = me === null;
  const canJoin = s.status === "published" && !p && s.remainingPlaces > 0;

  return (
    <article style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 20, marginTop: 18, maxWidth: 820 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="mono caps" style={{ fontSize: 12, color: "var(--ink-4)" }}>{s.typeLabel}</span>
        <Badge k={s.badge.key} label={s.badge.label} />
      </div>
      <h1 className="serif" style={{ fontSize: "clamp(30px, 5vw, 48px)", lineHeight: 1.1, margin: 0 }}>{s.title}</h1>
      <div style={{ fontSize: 15, color: "var(--ink-3)" }}>
        Proposé par <strong>{s.proName}</strong> · {s.zone} · durée estimée ~{s.estimatedMinutes} min
      </div>

      <div className="card" style={{ padding: 20, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <span className="serif" style={{ fontSize: 34, color: "var(--accent)" }}>{euro(s.rewardCents)}</span>
          <span style={{ fontSize: 13, color: "var(--ink-4)" }}>{s.remainingPlaces} place{s.remainingPlaces > 1 ? "s" : ""} restante{s.remainingPlaces > 1 ? "s" : ""}</span>
        </div>
        <Gauge joined={s.joinedCount} min={s.min} max={s.max} />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {s.status === "published" && <Countdown to={s.signupDeadline} label="Fin des inscriptions" />}
          <Countdown to={s.completionDeadline} label="Fin de réalisation" />
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{s.paidMention}</div>
      </div>

      <section>
        <h2 className="serif" style={{ fontSize: 22, marginBottom: 8 }}>Ce qui est demandé</h2>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, color: "var(--ink-2)" }}>{s.description}</p>
      </section>

      <section className="card" style={{ padding: 16, fontSize: 14, lineHeight: 1.6, color: "var(--ink-3)" }}>
        <strong>Comment ça marche :</strong> la campagne n&apos;est lancée que si {s.min} participants s&apos;inscrivent avant la fin des
        inscriptions. Vous recevez alors un code personnel à transmettre au professionnel en réalisant la tâche, puis vous cliquez
        « J&apos;ai terminé ». Vous êtes payé après sa validation, ou automatiquement au bout de 7 jours. Seuls votre prénom et un
        alias e-mail lui sont transmis.
      </section>

      {msg && (
        <div role="status" style={{ padding: 12, borderRadius: 10, background: msg.ok ? "#DCFCE7" : "#FEE2E2", color: msg.ok ? "#14532D" : "#7F1D1D" }}>
          {msg.text}
        </div>
      )}

      {p && (
        <div className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
          <div><strong>Ma participation :</strong> {PART_LABEL[p.status] ?? p.status}</div>
          {p.code && (
            <div>
              Votre code à transmettre :{" "}
              <span className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: ".15em" }}>{p.code}</span>
            </div>
          )}
          {me && me.role === "prospect" && me.access?.externalUrl && (
            <a className="btn btn-primary" href={me.access.externalUrl} target="_blank" rel="noopener noreferrer" style={{ justifySelf: "start" }}>
              Ouvrir le lien du professionnel ↗
            </a>
          )}
          {me && me.role === "prospect" && me.access?.address && <div>Adresse : {me.access.address}</div>}
          {p.status === "joined" && (
            <button className="btn btn-ghost" disabled={busy} style={{ justifySelf: "start" }} onClick={() => act("withdraw", {}, "Vous vous êtes retiré de la campagne.")}>
              Me retirer
            </button>
          )}
          {p.status === "confirmed" && (
            <div style={{ display: "grid", gap: 8 }}>
              <textarea className="input" rows={3} maxLength={500} placeholder="Commentaire facultatif (ex. où vous avez saisi votre code)" value={doneComment} onChange={(e) => setDoneComment(e.target.value)} />
              <button className="btn btn-primary" disabled={busy} style={{ justifySelf: "start" }} onClick={() => act("done", { comment: doneComment }, "Merci ! Le professionnel a 7 jours pour valider.")}>
                J&apos;ai terminé
              </button>
            </div>
          )}
          {p.status === "rejected" && (
            <div style={{ display: "grid", gap: 8 }}>
              <textarea className="input" rows={3} maxLength={1000} placeholder="Expliquez pourquoi vous contestez ce refus" value={disputeNote} onChange={(e) => setDisputeNote(e.target.value)} />
              <button className="btn btn-primary" disabled={busy || disputeNote.trim().length < 10} style={{ justifySelf: "start" }} onClick={() => act("dispute", { note: disputeNote }, "Contestation envoyée : BUUPP va trancher.")}>
                Contester le refus
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {canJoin && (
          loggedOut ? (
            <a className="btn btn-primary btn-lg" href={`/connexion?redirect_url=${encodeURIComponent(`/tests-etudes/${s.id}`)}`}>Participer</a>
          ) : me?.role === "prospect" ? (
            <button className="btn btn-primary btn-lg" onClick={() => setShowJoin(true)} disabled={!me.eligibleZone}>
              {me.eligibleZone ? "Participer" : "Hors de votre département"}
            </button>
          ) : (
            <span style={{ fontSize: 14, color: "var(--ink-4)" }}>La participation est réservée aux comptes particuliers.</span>
          )
        )}
        <button className="btn btn-ghost btn-lg" onClick={share}>Partager</button>
        {me?.role === "prospect" && !me.reported && (
          <button className="btn btn-ghost btn-lg" onClick={() => setShowReport(true)}>Signaler</button>
        )}
      </div>

      {showJoin && (
        <div className="card" style={{ padding: 18, display: "grid", gap: 12, border: "1px solid var(--accent)" }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5 }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              J&apos;accepte de participer à cette campagne. Si elle est validée, BUUPP transmettra à {s.proName} uniquement mon prénom
              et un alias e-mail, et je m&apos;engage à réaliser la tâche avant la date limite. Je peux me retirer tant que la campagne
              n&apos;est pas validée.
            </span>
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" disabled={!consent || busy} onClick={() => act("join", { consent: true }, "Inscription enregistrée ! Vous serez prévenu dès que la campagne est validée.")}>
              Confirmer ma participation
            </button>
            <button className="btn btn-ghost" onClick={() => setShowJoin(false)}>Annuler</button>
          </div>
        </div>
      )}

      {showReport && (
        <div className="card" style={{ padding: 18, display: "grid", gap: 10 }}>
          <strong>Signaler cette campagne</strong>
          <select className="input" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
            {Object.entries(REPORT_REASONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <textarea className="input" rows={3} maxLength={1000} placeholder="Précisions (facultatif)" value={reportNote} onChange={(e) => setReportNote(e.target.value)} />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => act("report", { reason: reportReason, note: reportNote }, "Merci, votre signalement a été transmis à BUUPP.")}>
              Envoyer
            </button>
            <button className="btn btn-ghost" onClick={() => setShowReport(false)}>Annuler</button>
          </div>
        </div>
      )}
    </article>
  );
}
