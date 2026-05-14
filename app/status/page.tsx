"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackHomeButton from "../_components/BackHomeButton";
import PageVersion from "../_components/PageVersion";

type Status = "operational" | "degraded" | "down";
type ComponentResult = {
  id: string;
  name: string;
  status: Status;
  latencyMs?: number;
  message?: string;
};
type StatusResponse = {
  overall: Status;
  components: ComponentResult[];
  checkedAt: string;
};

const REFRESH_MS = 30_000;

const LABEL: Record<Status, string> = {
  operational: "Opérationnel",
  degraded: "Dégradé",
  down: "Indisponible",
};

const COLOR: Record<Status, { bg: string; ring: string; ink: string }> = {
  operational: { bg: "#15803D", ring: "#86EFAC", ink: "#FFFFFF" },
  degraded:    { bg: "#B45309", ring: "#FCD34D", ink: "#FFFFFF" },
  down:        { bg: "#B91C1C", ring: "#FCA5A5", ink: "#FFFFFF" },
};

const OVERALL_BANNER: Record<Status, string> = {
  operational: "Tous les services BUUPP fonctionnent normalement.",
  degraded:
    "Service partiellement perturbé : certaines fonctions peuvent être lentes ou momentanément indisponibles.",
  down:
    "Incident en cours sur un composant critique. Nous travaillons à un retour à la normale.",
};

/* Composants surveillés et leur description côté utilisateur — ce libellé
   est affiché sous le nom technique pour que les prospects et pros sachent
   ce qui est concerné concrètement quand un voyant passe au orange/rouge. */
const COMPONENT_DESC: Record<string, string> = {
  api: "Cœur applicatif : pages, dashboard, lancement de campagne, mise en relation.",
  db: "Stockage des données : paliers prospects, campagnes, transactions, BUUPP Score.",
  auth: "Connexion et création de compte (Clerk).",
  stripe:
    "Recharge du portefeuille pro, retraits prospects vers IBAN, commission BUUPP.",
  messaging:
    "SMS de vérification téléphone et emails (sollicitations, encaissement, parrainage).",
};

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as StatusResponse;
        if (!cancelled) {
          setData(j);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "fetch error");
          // En cas d'erreur réseau on bascule l'API en "down" côté UI —
          // c'est le seul composant qu'on peut diagnostiquer côté client.
          setData({
            overall: "down",
            components: [
              {
                id: "api",
                name: "API applicative",
                status: "down",
                message: "Impossible de joindre /api/status",
              },
            ],
            checkedAt: new Date().toISOString(),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const overall: Status = data?.overall ?? "operational";
  const overallColor = COLOR[overall];

  return (
    <div className="page" style={{ background: "var(--ivory)", paddingBottom: 96 }}>
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "clamp(40px, 7vw, 64px) 24px 24px",
        }}
      >
        <Link
          href="/"
          aria-label="Retour à l'accueil BUUPP"
          style={{ display: "inline-block", marginBottom: 32, lineHeight: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="BUUPP"
            style={{ height: 44, width: "auto", display: "block" }}
          />
        </Link>
        <div
          className="mono caps"
          style={{ color: "var(--ink-4)", marginBottom: 14 }}
        >
          État du service
        </div>
        <PageVersion version="1.0" />
        <h1
          className="serif"
          style={{
            fontSize: "clamp(36px, 6vw, 64px)",
            lineHeight: 1.05,
            marginBottom: 18,
          }}
        >
          Statut de BUUPP
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.65,
            color: "var(--ink-3)",
            maxWidth: 680,
          }}
        >
          Cette page est mise à jour automatiquement toutes les 30 secondes.
          Elle indique en temps réel la disponibilité des composants
          critiques de la plateforme.
        </p>
      </div>

      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {/* Bandeau global */}
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "20px 22px",
            borderRadius: 14,
            background: overallColor.bg,
            color: overallColor.ink,
            boxShadow: `0 0 0 6px ${overallColor.ring}33`,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: overallColor.ink,
              boxShadow: `0 0 0 4px ${overallColor.ink}33`,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>
              {LABEL[overall]}
            </div>
            <div style={{ fontSize: 14, opacity: 0.95, marginTop: 4 }}>
              {OVERALL_BANNER[overall]}
            </div>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {data?.checkedAt
              ? new Date(data.checkedAt).toLocaleTimeString("fr-FR")
              : "—"}
          </div>
        </div>

        {/* Composants */}
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {loading && !data ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 14 }}>
              Diagnostic en cours…
            </div>
          ) : (
            (data?.components ?? []).map((c, i, arr) => {
              const col = COLOR[c.status];
              return (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "16px 20px",
                    borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line)",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: col.bg,
                      boxShadow: `0 0 0 4px ${col.ring}55`,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 2 }}>
                      {COMPONENT_DESC[c.id] ?? ""}
                    </div>
                    {c.message && (
                      <div
                        className="mono"
                        style={{
                          fontSize: 12,
                          color: c.status === "operational" ? "var(--ink-4)" : col.bg,
                          marginTop: 4,
                        }}
                      >
                        {c.message}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: col.bg,
                        color: col.ink,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: ".04em",
                      }}
                    >
                      {LABEL[c.status]}
                    </span>
                    {typeof c.latencyMs === "number" && (
                      <div
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: "var(--ink-4)",
                          marginTop: 4,
                        }}
                      >
                        {c.latencyMs} ms
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Note d'information / SLA — explique le projet */}
        <div
          style={{
            padding: "20px 22px",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--ink-3)",
          }}
        >
          <div className="serif" style={{ fontSize: 18, color: "var(--ink)", marginBottom: 6 }}>
            Comment lire cette page ?
          </div>
          <ul style={{ paddingLeft: 18, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
            <li>
              <strong>Opérationnel</strong> — le composant répond dans les
              temps : navigation, dashboard, lancement de campagne et
              acceptation de mise en relation fonctionnent normalement.
            </li>
            <li>
              <strong>Dégradé</strong> — le service répond mais avec des
              latences inhabituelles. Une recharge de portefeuille ou un
              retrait IBAN peut prendre quelques secondes de plus.
            </li>
            <li>
              <strong>Indisponible</strong> — le composant est inaccessible.
              Les opérations dépendantes (envoi d&apos;un SMS de
              vérification, paiement Stripe, persistance d&apos;un palier)
              peuvent échouer le temps de la résolution.
            </li>
          </ul>
        </div>

        {/* Historique d'incidents — placeholder pour l'instant */}
        <div
          style={{
            padding: "20px 22px",
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: 14,
          }}
        >
          <div className="serif" style={{ fontSize: 18, color: "var(--ink)", marginBottom: 6 }}>
            Historique des incidents
          </div>
          <div style={{ fontSize: 14, color: "var(--ink-4)", lineHeight: 1.6 }}>
            Aucun incident à signaler sur les 30 derniers jours. Les
            incidents passés sont conservés à des fins de transparence et
            seront listés ici dès qu&apos;ils surviendront, avec leur durée,
            leur impact et la résolution apportée.
          </div>
        </div>

        {error && !loading && (
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-5)",
              textAlign: "center",
            }}
          >
            Dernière erreur réseau : {error}
          </div>
        )}

        <div
          style={{
            marginTop: 8,
            paddingTop: 28,
            borderTop: "1px solid var(--line)",
          }}
        >
          <BackHomeButton />
        </div>
      </div>
    </div>
  );
}
