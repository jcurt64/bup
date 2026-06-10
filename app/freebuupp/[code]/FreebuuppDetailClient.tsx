"use client";

import { useEffect, useState } from "react";

type Detail = {
  code: string;
  title: string;
  prizeDescription: string;
  brandName: string;
  panelSize: number;
  winnersCount: number;
  status: string;
  geo: string;
  opensAt: string;
  closesAt: string;
  drawnAt: string | null;
  participantCount: number;
  participantNumbers: number[];
  winningNumbers: number[];
  seedHash: string;
  seed: string | null;
};

export default function FreebuuppDetailClient({ code }: { code: string }) {
  const [fb, setFb] = useState<Detail | null | "404">(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/freebuupps/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then((r) => (r.status === 404 ? "404" : r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        if (j === "404" || !j) setFb("404");
        else setFb(j.freebuupp as Detail);
      })
      .catch(() => {
        if (!cancelled) setFb("404");
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (fb === null) return <div className="card" style={{ padding: 24 }}>Chargement…</div>;
  if (fb === "404") return <div className="card" style={{ padding: 24 }}>Ce FREEBUUPP est introuvable.</div>;

  const isDrawn = fb.status === "drawn";
  const winSet = new Set(fb.winningNumbers);

  return (
    <div className="col gap-6">
      <div>
        <div className="mono caps" style={{ color: "var(--ink-4)", fontSize: 12 }}>{fb.brandName}</div>
        <h1 className="serif" style={{ fontSize: "clamp(26px, 5vw, 40px)", margin: "4px 0 8px" }}>{fb.title}</h1>
        <p style={{ color: "var(--ink-3)", margin: 0 }}>🎁 {fb.prizeDescription}</p>
      </div>

      <div className="card" style={{ padding: 20, display: "flex", flexWrap: "wrap", gap: 24 }}>
        <Stat label="Participants" value={`${fb.participantCount} / ${fb.panelSize}`} />
        <Stat label="Gagnants" value={String(fb.winnersCount)} />
        <Stat label="Statut" value={isDrawn ? "Tiré" : fb.status === "open" ? "En cours" : "En attente de tirage"} />
      </div>

      {isDrawn && (
        <div className="card" style={{ padding: 24 }}>
          <h2 className="serif" style={{ fontSize: 22, margin: "0 0 12px" }}>🎉 Numéros gagnants</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {fb.winningNumbers.map((n) => (
              <span key={n} style={{ display: "inline-block", padding: "8px 14px", borderRadius: 10, background: "var(--ink)", color: "var(--ivory)", fontWeight: 600 }}>
                #{n}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 24 }}>
        <h2 className="serif" style={{ fontSize: 20, margin: "0 0 8px" }}>🔒 Tirage vérifiable</h2>
        <p style={{ color: "var(--ink-3)", marginTop: 0 }}>
          Le tirage est <strong>provably-fair</strong> : l&apos;empreinte (hash) est publiée dès l&apos;ouverture,
          la graine est révélée au tirage. N&apos;importe qui peut recalculer les gagnants.
        </p>
        <Field label="Empreinte (sha256 de la graine)" value={fb.seedHash} />
        {isDrawn && fb.seed && <Field label="Graine révélée" value={fb.seed} />}
        {isDrawn ? (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", color: "var(--ink-3)" }}>Comment vérifier le tirage&nbsp;?</summary>
            <ol style={{ color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
              <li>Vérifiez que <code>sha256(graine)</code> est bien égal à l&apos;empreinte ci-dessus.</li>
              <li>Pour chaque numéro de participant <code>n</code>, calculez <code>sha256(&quot;graine:n&quot;)</code>.</li>
              <li>Triez les participants par ce hash (ordre croissant) et prenez les {fb.winnersCount} premiers.</li>
              <li>Vous obtenez exactement les numéros gagnants affichés. ✅</li>
            </ol>
          </details>
        ) : (
          <p style={{ color: "var(--ink-4)", fontSize: 13, marginBottom: 0 }}>
            La graine sera révélée une fois le tirage effectué.
          </p>
        )}
      </div>

      {fb.participantNumbers.length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h2 className="serif" style={{ fontSize: 18, margin: "0 0 12px" }}>Participants ({fb.participantNumbers.length})</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {fb.participantNumbers.map((n) => (
              <span
                key={n}
                style={{
                  display: "inline-block",
                  padding: "4px 9px",
                  borderRadius: 8,
                  fontSize: 13,
                  background: winSet.has(n) ? "var(--ink)" : "var(--bg-2, #efece4)",
                  color: winSet.has(n) ? "var(--ivory)" : "var(--ink-3)",
                  fontWeight: winSet.has(n) ? 600 : 400,
                }}
              >
                #{n}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono caps" style={{ color: "var(--ink-4)", fontSize: 11 }}>{label}</div>
      <div className="serif" style={{ fontSize: 22 }}>{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="mono caps" style={{ color: "var(--ink-4)", fontSize: 11 }}>{label}</div>
      <code style={{ wordBreak: "break-all", fontSize: 12, color: "var(--ink-2, #333)" }}>{value}</code>
    </div>
  );
}
