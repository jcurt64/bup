/**
 * /buupp-admin/non-atteint — Centre d'analyse des prospects signalés
 * non joignables. Refonte visuelle alignée sur `public/prototype/no.png`
 * (intro éditoriale, cartes KPI à pastilles colorées, mini-cartes de
 * distribution à barres, liste d'alertes en cartes bordées d'ambre).
 *
 * Server Component : lit via fetchNonAtteintOverview() en service_role.
 */
import {
  fetchNonAtteintOverview,
  type DistributionEntry,
} from "@/lib/admin/queries/non-atteint";
import AdminIcon, { type AdminIconName } from "../_components/AdminIcon";
import KpiCard from "../_components/KpiCard";

export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("fr-FR");

function formatDateFr(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default async function NonAtteintAdminPage() {
  const data = await fetchNonAtteintOverview();
  const { prospectStats, proStats, alerts } = data;
  const totalSignalements = alerts.reduce((acc, a) => acc + a.count, 0);

  return (
    <div className="space-y-7">
      {/* ─── Intro éditoriale ─────────────────────────────────────── */}
      <header className="space-y-2 max-w-3xl">
        <div
          className="text-[11px] font-bold uppercase"
          style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.14em" }}
        >
          Anti-fraude · Joignabilité
        </div>
        <h2
          style={{
            fontFamily: "var(--serif)",
            fontSize: 24,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          Prospects non atteints
        </h2>
        <p className="text-sm" style={{ color: "var(--ink-3)", lineHeight: 1.6 }}>
          Liste des alertes générées quand un prospect a été signalé{" "}
          <strong style={{ color: "var(--ink-2)" }}>non atteint</strong> au moins{" "}
          <strong style={{ color: "var(--ink-2)" }}>2 fois</strong> par les pros (tous pros
          confondus). Ces prospects ont accepté la sollicitation (et touché leur
          rémunération) mais n&apos;ont pas répondu aux tentatives de contact. Un
          message gentil leur est envoyé automatiquement.
        </p>
      </header>

      {/* ─── KPIs ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard hideDelta icon="flag" accent="#EC4899" label="Prospects flaggés" value={fmt.format(prospectStats.total)} />
        <KpiCard hideDelta icon="briefcase" accent="#10B981" label="Pros impliqués" value={fmt.format(proStats.total)} />
        <KpiCard hideDelta icon="ban" accent="#F59E0B" label="Alertes (events)" value={fmt.format(alerts.length)} />
        <KpiCard hideDelta icon="list" accent="#6366F1" label="Signalements totaux" value={fmt.format(totalSignalements)} />
      </div>

      {/* ─── Profil prospects ─────────────────────────────────────── */}
      <section>
        <SectionHead icon="users" accent="#10B981" title="Profil des prospects signalés" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <DistMini title="Tranches d'âge" data={prospectStats.ageRanges} color="#6366F1" />
          <DistMini title="Genre" data={prospectStats.genre} color="#DC2626" />
          <DistMini title={`Top villes (${prospectStats.villesUnique} uniques)`} data={prospectStats.topVilles} color="#6366F1" />
          <DistMini title="Top départements" data={prospectStats.departements} color="#6366F1" />
        </div>
      </section>

      {/* ─── Profil pros ──────────────────────────────────────────── */}
      <section>
        <SectionHead icon="briefcase" accent="#10B981" title="Profil des pros à l'origine des signalements" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <DistMini title="Secteurs d'activité" data={proStats.secteurs} color="#10B981" />
          <DistMini title="Plans BUUPP" data={proStats.plans} color="#3B82F6" />
          <DistMini title={`Top villes (${proStats.villesUnique} uniques)`} data={proStats.topVilles} color="#6366F1" />
          <DistMini title="Top départements" data={proStats.departements} color="#6366F1" />
        </div>
      </section>

      {/* ─── Alertes reçues ───────────────────────────────────────── */}
      <section>
        <SectionHead icon="bell" accent="#F59E0B" title={`Alertes reçues (${alerts.length})`} />
        {alerts.length === 0 ? (
          <Card>
            <EmptyState text="Aucune alerte pour le moment. 🎉" />
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => {
              const accent =
                a.severity === "critical" ? "var(--danger)" : "#D4A017";
              return (
                <div
                  key={a.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderLeft: `4px solid ${accent}`,
                    boxShadow: "var(--shadow-1)",
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className="inline-flex items-center justify-center rounded-lg shrink-0 mt-0.5"
                          style={{
                            width: 30,
                            height: 30,
                            background: "color-mix(in oklab, #D4A017 16%, var(--paper))",
                            color: "#9A6B00",
                          }}
                        >
                          <AdminIcon name="ban" size={16} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold" style={{ color: "var(--ink)", fontSize: 14 }}>
                              {a.prospectName}
                            </span>
                            {a.prospectVille && (
                              <span style={{ color: "var(--ink-4)", fontSize: 13 }}>
                                · {a.prospectVille}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            <span
                              className="inline-flex items-center rounded-md font-bold"
                              style={{
                                padding: "2px 8px",
                                fontSize: 11,
                                fontFamily: "var(--mono)",
                                background: "color-mix(in oklab, #D4A017 16%, var(--paper))",
                                color: "#9A6B00",
                              }}
                            >
                              {a.count}× non atteint
                            </span>
                            <span style={{ color: "var(--ink-3)", fontSize: 13 }}>
                              message gentil envoyé au prospect.
                            </span>
                          </div>
                        </div>
                      </div>
                      <span
                        className="shrink-0 whitespace-nowrap"
                        style={{ color: "var(--ink-5)", fontSize: 11, fontFamily: "var(--mono)" }}
                      >
                        {formatDateFr(a.createdAt)}
                      </span>
                    </div>
                  </div>
                  {a.pros.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--line)" }}>
                      {a.pros.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 px-4 py-2.5"
                          style={{
                            background: "var(--ivory)",
                            borderTop: i === 0 ? undefined : "1px solid var(--line)",
                          }}
                        >
                          <span className="truncate" style={{ color: "var(--ink-2)", fontSize: 13 }}>
                            {p.raisonSociale}
                          </span>
                          <span
                            className="shrink-0 whitespace-nowrap"
                            style={{ color: "var(--ink-5)", fontSize: 11, fontFamily: "var(--mono)" }}
                          >
                            {formatDateFr(p.flaggedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Helpers de présentation
// ──────────────────────────────────────────────────────────────────

function SectionHead({
  icon,
  accent,
  title,
}: {
  icon: AdminIconName;
  accent: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span
        className="inline-flex items-center justify-center rounded-lg shrink-0"
        style={{
          width: 28,
          height: 28,
          background: `color-mix(in oklab, ${accent} 14%, var(--paper))`,
          color: accent,
        }}
      >
        <AdminIcon name={icon} size={15} />
      </span>
      <span
        className="text-[12px] font-bold uppercase"
        style={{ color: "var(--ink-2)", fontFamily: "var(--mono)", letterSpacing: "0.1em" }}
      >
        {title}
      </span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      {children}
    </div>
  );
}

function DistMini({
  title,
  data,
  color,
}: {
  title: string;
  data: DistributionEntry[];
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow-1)" }}
    >
      <div
        className="text-[10.5px] font-bold uppercase mb-3"
        style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.1em" }}
      >
        {title}
      </div>
      {data.length === 0 ? (
        <EmptyState text="Aucune donnée." />
      ) : (
        <div className="space-y-2">
          {(() => {
            const max = Math.max(...data.map((d) => d.n), 1);
            return data.map((d) => (
              <div key={d.key} className="flex items-center gap-2.5">
                <div
                  className="shrink-0 truncate text-[13px]"
                  style={{ width: "42%", color: "var(--ink-2)" }}
                  title={d.key}
                >
                  {d.key}
                </div>
                <div className="flex-1 h-3 rounded-full" style={{ background: "var(--ivory-2)" }}>
                  <div
                    className="h-3 rounded-full"
                    style={{
                      width: `${Math.max((d.n / max) * 100, d.n > 0 ? 8 : 0)}%`,
                      background: `linear-gradient(90deg, color-mix(in oklab, ${color} 78%, white), ${color})`,
                    }}
                  />
                </div>
                <div
                  className="w-6 text-right tabular-nums font-bold shrink-0"
                  style={{ color: "var(--ink)", fontSize: 13 }}
                >
                  {fmt.format(d.n)}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-sm" style={{ color: "var(--ink-4)" }}>
      <span
        className="inline-flex items-center justify-center rounded-full shrink-0"
        style={{ width: 20, height: 20, border: "1.5px solid var(--line-2)", color: "var(--ink-5)" }}
        aria-hidden
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
      {text}
    </div>
  );
}
