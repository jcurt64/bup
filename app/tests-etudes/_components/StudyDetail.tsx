"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicStudy } from "@/lib/studies/repo";
import { REPORT_REASONS } from "@/lib/studies/constants";
import { Badge, Gauge, LiveCountdown, euro, useNow } from "./StudyBits";
import { StudyIcon, TYPE_THEME, type StudyIconName } from "./StudyIcons";

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
  not_withdrawable: "Il n'est plus possible de se retirer.",
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

export default function StudyDetail({ initial, autoJoin = false }: { initial: PublicStudy; autoJoin?: boolean }) {
  const [s, setS] = useState(initial);
  const [me, setMe] = useState<Me>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("scam");
  const [reportNote, setReportNote] = useState("");
  const [doneComment, setDoneComment] = useState("");
  const [disputeNote, setDisputeNote] = useState("");
  const joinRef = useRef<HTMLDivElement>(null);
  const now = useNow(1000);
  const t = TYPE_THEME[s.type] ?? TYPE_THEME.survey;
  const loginUrl = `/connexion?redirect_url=${encodeURIComponent(`/tests-etudes/${initial.id}?participer=1`)}`;

  const load = useCallback(async () => {
    const r = await fetch(`/api/studies/${initial.id}`, { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setS(d.study);
      setMe(d.me);
    }
    setLoaded(true);
  }, [initial.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement asynchrone (setState après await)
  useEffect(() => { void load(); }, [load]);

  // « Je participe » depuis la liste : ouvre directement l'inscription
  // (ou la connexion si le visiteur n'a pas de compte).
  useEffect(() => {
    if (!autoJoin || !loaded) return;
    if (me === null) { window.location.href = loginUrl; return; }
    if (me.role === "prospect" && !me.participation && s.status === "published") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ouverture pilotée par l'URL
      setShowJoin(true);
      setTimeout(() => joinRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }
  }, [autoJoin, loaded, me, s.status, loginUrl]);

  async function act(path: string, body: Record<string, unknown> = {}, okText = "C'est fait.") {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/studies/${s.id}/${path}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { window.location.href = loginUrl; return; }
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
    const url = `${window.location.origin}/tests-etudes/${s.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: s.title, text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setMsg({ ok: true, text: "Lien copié dans le presse-papiers." });
    } catch { /* partage annulé */ }
  }

  const p = me && me.role === "prospect" ? me.participation : null;
  const open = s.status === "published" && s.remainingPlaces > 0;
  const remaining = Math.max(0, s.min - s.joinedCount);
  const grad = `linear-gradient(115deg, ${t.from}, ${t.to})`;

  return (
    <>
      <section className="sd-hero" data-nav-theme="dark" style={{ background: grad }}>
        <div className="sd-hero-inner">
          <Link href="/tests-etudes" className="sd-back"><StudyIcon name="arrow" size={16} />Toutes les campagnes</Link>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="st-type"><span className="st-type-ic"><StudyIcon name={s.type as StudyIconName} size={18} /></span>{s.typeLabel}</span>
            <span style={{ background: "rgba(255,255,255,.95)", borderRadius: 999 }}><Badge k={s.badge.key} label={s.badge.label} /></span>
          </div>
          <h1 className="serif sd-title">{s.title}</h1>
          <div className="sd-sub">
            <span><StudyIcon name="users" size={16} />Proposé par <strong>{s.proName}</strong></span>
            <span><StudyIcon name="pin" size={16} />{s.zone}</span>
            <span><StudyIcon name="clock" size={16} />~{s.estimatedMinutes} min</span>
          </div>
        </div>
      </section>

      <div className="sd-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="sd-panel">
            <h2 className="sd-h2"><span style={{ color: t.ink }}><StudyIcon name="sparkles" size={22} /></span>Ce qui est demandé</h2>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--ink-2)", fontSize: 16, margin: 0 }}>{s.description}</p>
          </section>
          <section className="sd-panel">
            <h2 className="sd-h2"><span style={{ color: t.ink }}><StudyIcon name="check" size={22} /></span>Comment ça marche</h2>
            <div className="sd-steps">
              {[
                `Inscrivez-vous avant la fin des inscriptions. La campagne n'est lancée que si ${s.min} participants s'inscrivent.`,
                "Une fois lancée, vous recevez votre code personnel et le lien ou l'adresse du professionnel.",
                "Réalisez la tâche, transmettez votre code au professionnel, puis cliquez « J'ai terminé ».",
                `Vous recevez ${euro(s.rewardCents)} dans votre portefeuille après validation, ou automatiquement au bout de 7 jours.`,
              ].map((txt, k) => (
                <div key={k} className="sd-step"><span className="sd-step-n" style={{ background: grad }}>{k + 1}</span><span>{txt}</span></div>
              ))}
            </div>
          </section>
          <section className="sd-panel" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span className="st-trust-ic" style={{ background: t.soft, color: t.ink }}><StudyIcon name="lock" size={22} /></span>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink-3)" }}>
              <strong style={{ color: "var(--ink)" }}>Vos données restent protégées.</strong> Seuls votre prénom et un alias e-mail BUUPP
              sont transmis au professionnel, et uniquement si la campagne est lancée. {s.paidMention}.
            </div>
          </section>
        </div>

        <aside className="sd-side">
          <div className="sd-panel" style={{ padding: 0, overflow: "hidden" }}>
            <div className="st-card-top" style={{ background: grad }}>
              <div className="st-reward" style={{ marginTop: 0 }}><span className="st-reward-v">{euro(s.rewardCents)}</span><span className="st-reward-l">par participant</span></div>
              <div style={{ position: "relative", marginTop: 8, fontSize: 13, opacity: .92 }}>
                {open ? (remaining > 0 ? `Plus que ${remaining} participant${remaining > 1 ? "s" : ""} pour lancer la campagne` : `${s.remainingPlaces} place${s.remainingPlaces > 1 ? "s" : ""} restante${s.remainingPlaces > 1 ? "s" : ""}`) : s.badge.label}
              </div>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <Gauge joined={s.joinedCount} min={s.min} max={s.max} type={s.type} />
              {s.status === "published" && <LiveCountdown to={s.signupDeadline} label="Pour participer" now={now} />}
              <LiveCountdown to={s.completionDeadline} label="Réalisation" now={now} />

              {msg && (
                <div role="status" className="sd-msg" style={{ background: msg.ok ? "#DCFCE7" : "#FEE2E2", color: msg.ok ? "#14532D" : "#7F1D1D" }}>{msg.text}</div>
              )}

              {p ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <span style={{ color: "#16A34A" }}><StudyIcon name="check" size={18} /></span>
                    <strong>{PART_LABEL[p.status] ?? p.status}</strong>
                  </div>
                  {p.code && (<><div style={{ fontSize: 13, color: "var(--ink-4)" }}>Votre code à transmettre au professionnel :</div><div className="sd-code">{p.code}</div></>)}
                  {me && me.role === "prospect" && me.access?.externalUrl && (
                    <a className="st-cta" href={me.access.externalUrl} target="_blank" rel="noopener noreferrer" style={{ background: grad, flex: "none" }}>
                      Ouvrir le lien du professionnel <StudyIcon name="arrow" size={16} />
                    </a>
                  )}
                  {me && me.role === "prospect" && me.access?.address && (
                    <div style={{ display: "flex", gap: 8, fontSize: 14 }}><StudyIcon name="pin" size={18} />{me.access.address}</div>
                  )}
                  {p.status === "joined" && (
                    <button className="btn btn-ghost" disabled={busy} onClick={() => act("withdraw", {}, "Vous vous êtes retiré de la campagne.")}>Me retirer</button>
                  )}
                  {p.status === "confirmed" && (
                    <>
                      <textarea className="sd-textarea" rows={3} maxLength={500} placeholder="Commentaire facultatif (ex. où vous avez saisi votre code)" value={doneComment} onChange={(e) => setDoneComment(e.target.value)} />
                      <button className="st-cta" style={{ background: grad, flex: "none" }} disabled={busy} onClick={() => act("done", { comment: doneComment }, "Merci ! Le professionnel a 7 jours pour valider.")}>
                        J&apos;ai terminé <StudyIcon name="check" size={16} />
                      </button>
                    </>
                  )}
                  {p.status === "rejected" && (
                    <>
                      <textarea className="sd-textarea" rows={3} maxLength={1000} placeholder="Expliquez pourquoi vous contestez ce refus" value={disputeNote} onChange={(e) => setDisputeNote(e.target.value)} />
                      <button className="st-cta" style={{ background: grad, flex: "none" }} disabled={busy || disputeNote.trim().length < 10} onClick={() => act("dispute", { note: disputeNote }, "Contestation envoyée : BUUPP va trancher.")}>
                        Contester le refus
                      </button>
                    </>
                  )}
                </div>
              ) : open ? (
                me === null ? (
                  <a className="st-cta" href={loginUrl} style={{ background: grad, flex: "none" }}>Je participe <StudyIcon name="arrow" size={16} /></a>
                ) : me.role === "prospect" ? (
                  me.eligibleZone ? (
                    <button className="st-cta" style={{ background: grad, flex: "none" }} onClick={() => setShowJoin(true)}>Je participe <StudyIcon name="arrow" size={16} /></button>
                  ) : (
                    <span className="st-cta" aria-disabled="true" style={{ flex: "none" }}>Hors de votre département</span>
                  )
                ) : (
                  <div style={{ fontSize: 14, color: "var(--ink-4)" }}>La participation est réservée aux comptes particuliers.</div>
                )
              ) : (
                <span className="st-cta" aria-disabled="true" style={{ flex: "none" }}>{s.status === "validated" ? "Inscriptions closes" : s.badge.label}</span>
              )}

              {showJoin && (
                <div ref={joinRef} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14, borderRadius: 14, border: `1.5px solid ${t.from}`, background: t.soft }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5 }}>
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>
                      J&apos;accepte de participer. Si la campagne est lancée, BUUPP transmettra à {s.proName} uniquement mon prénom et un
                      alias e-mail, et je m&apos;engage à réaliser la tâche avant la date limite. Je peux me retirer tant qu&apos;elle n&apos;est pas lancée.
                    </span>
                  </label>
                  <div className="sd-row-btns">
                    <button className="st-cta" style={{ background: grad }} disabled={!consent || busy}
                      onClick={() => act("join", { consent: true }, "Inscription enregistrée ! Vous serez prévenu dès que la campagne est lancée.")}>
                      Confirmer
                    </button>
                    <button className="btn btn-ghost" onClick={() => setShowJoin(false)}>Annuler</button>
                  </div>
                </div>
              )}

              <div className="sd-row-btns">
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", gap: 8 }} onClick={share}><StudyIcon name="share" size={16} />Partager</button>
                {me?.role === "prospect" && !me.reported && (
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", gap: 8 }} onClick={() => setShowReport((v) => !v)}><StudyIcon name="flag" size={16} />Signaler</button>
                )}
              </div>

              {showReport && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <select className="input" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                    {Object.entries(REPORT_REASONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <textarea className="sd-textarea" rows={3} maxLength={1000} placeholder="Précisions (facultatif)" value={reportNote} onChange={(e) => setReportNote(e.target.value)} />
                  <button className="btn btn-primary" disabled={busy} onClick={() => act("report", { reason: reportReason, note: reportNote }, "Merci, votre signalement a été transmis à BUUPP.")}>Envoyer le signalement</button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
