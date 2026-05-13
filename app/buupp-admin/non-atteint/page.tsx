/**
 * /buupp-admin/non-atteint — Centre d'analyse des prospects signalés
 * non joignables. Affiche :
 *   - Vue d'ensemble (KPI cards : nb prospects flaggés, nb pros impliqués,
 *     villes uniques, alertes ouvertes)
 *   - Distribution prospects (genre, âge, top villes, dépts)
 *   - Distribution pros (secteur, plan, top villes, dépts)
 *   - Liste détaillée des alertes (admin_events) avec pros + dates
 *
 * Server Component : lit via fetchNonAtteintOverview() en service_role.
 */
import { fetchNonAtteintOverview } from "@/lib/admin/queries/non-atteint";

export const dynamic = "force-dynamic";

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
    <div className="space-y-6">
      <header className="space-y-1">
        <div
          className="text-[11px] uppercase"
          style={{
            color: "var(--ink-4)",
            fontFamily: "var(--mono)",
            letterSpacing: "0.06em",
          }}
        >
          Anti-fraude · Joignabilité
        </div>
        <h1 className="text-xl font-medium" style={{ letterSpacing: "-0.01em" }}>
          Prospects non atteints
        </h1>
        <p
          className="text-sm"
          style={{ color: "var(--ink-3)", maxWidth: 720 }}
        >
          Liste des alertes générées quand un prospect a été signalé{" "}
          <strong>non atteint</strong> au moins <strong>2 fois</strong> par les
          pros (tous pros confondus). Ces prospects ont accepté la sollicitation
          (et touché leur rémunération) mais n'ont pas répondu aux tentatives de
          contact. Un message gentil leur est envoyé automatiquement.
        </p>
      </header>

      {/* KPIs top-level */}
      <KpiGrid
        items={[
          { label: "Prospects flaggés", value: prospectStats.total },
          { label: "Pros impliqués", value: proStats.total },
          { label: "Alertes (events)", value: alerts.length },
          { label: "Signalements totaux", value: totalSignalements },
        ]}
      />

      {/* Distributions prospects */}
      <section className="space-y-3">
        <SectionTitle title="Profil des prospects signalés" />
        <div className="non-atteint-grid">
          <Card title="Tranches d'âge">
            <Histo data={prospectStats.ageRanges} />
          </Card>
          <Card title="Genre">
            <Histo data={prospectStats.genre} />
          </Card>
          <Card title={`Top villes (${prospectStats.villesUnique} uniques)`}>
            {prospectStats.topVilles.length === 0 ? (
              <Empty />
            ) : (
              <Histo data={prospectStats.topVilles} />
            )}
          </Card>
          <Card title="Top départements">
            {prospectStats.departements.length === 0 ? (
              <Empty />
            ) : (
              <Histo data={prospectStats.departements} />
            )}
          </Card>
        </div>
      </section>

      {/* Distributions pros */}
      <section className="space-y-3">
        <SectionTitle title="Profil des pros à l'origine des signalements" />
        <div className="non-atteint-grid">
          <Card title="Secteurs d'activité">
            <Histo data={proStats.secteurs} />
          </Card>
          <Card title="Plans BUUPP">
            <Histo data={proStats.plans} />
          </Card>
          <Card title={`Top villes (${proStats.villesUnique} uniques)`}>
            {proStats.topVilles.length === 0 ? (
              <Empty />
            ) : (
              <Histo data={proStats.topVilles} />
            )}
          </Card>
          <Card title="Top départements">
            {proStats.departements.length === 0 ? (
              <Empty />
            ) : (
              <Histo data={proStats.departements} />
            )}
          </Card>
        </div>
      </section>

      {/* Liste des alertes */}
      <section className="space-y-3">
        <SectionTitle title={`Alertes reçues (${alerts.length})`} />
        <div
          className="rounded-lg overflow-hidden"
          style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
        >
          {alerts.length === 0 ? (
            <div className="p-6">
              <Empty label="Aucune alerte pour le moment. 🎉" />
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--line-2)" }}>
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="p-3 sm:p-4"
                  style={{
                    borderLeft: `3px solid ${
                      a.severity === "critical"
                        ? "var(--danger)"
                        : a.severity === "warning"
                          ? "var(--warn)"
                          : "var(--line-2)"
                    }`,
                  }}
                >
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <div>
                      <div
                        className="font-medium"
                        style={{ color: "var(--ink)", fontSize: 14 }}
                      >
                        🔕 {a.prospectName}
                        {a.prospectVille && (
                          <span
                            className="ml-2"
                            style={{ color: "var(--ink-4)", fontWeight: 400 }}
                          >
                            · {a.prospectVille}
                          </span>
                        )}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--ink-3)" }}
                      >
                        {a.count}× signalé non atteint — message gentil envoyé
                        au prospect.
                      </div>
                    </div>
                    <div
                      className="text-xs"
                      style={{
                        color: "var(--ink-5)",
                        fontFamily: "var(--mono)",
                      }}
                    >
                      {formatDateFr(a.createdAt)}
                    </div>
                  </div>
                  {a.pros.length > 0 && (
                    <ul
                      className="space-y-0.5"
                      style={{
                        paddingLeft: 0,
                        listStyle: "none",
                        fontSize: 11,
                        color: "var(--ink-3)",
                      }}
                    >
                      {a.pros.map((p, i) => (
                        <li
                          key={i}
                          className="flex justify-between gap-3 flex-wrap"
                          style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: "rgba(15,22,41,0.03)",
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{p.raisonSociale}</span>
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              color: "var(--ink-5)",
                            }}
                          >
                            {formatDateFr(p.flaggedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Styles responsive — grid 2-col tablet, 4-col desktop. */}
      <style>{`
        .non-atteint-grid {
          display: grid;
          gap: 14px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 640px) {
          .non-atteint-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
          .non-atteint-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </div>
  );
}

/* ─── UI atoms ─────────────────────────────────────────────────────── */

function SectionTitle({ title }: { title: string }) {
  return (
    <h2
      className="text-sm font-medium"
      style={{
        color: "var(--ink-2)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 11,
        fontFamily: "var(--mono)",
      }}
    >
      {title}
    </h2>
  );
}

function KpiGrid({ items }: { items: { label: string; value: number }[] }) {
  return (
    <>
      <div className="kpi-grid">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-lg p-3"
            style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
          >
            <div
              className="text-[10px] uppercase mb-1"
              style={{
                color: "var(--ink-4)",
                fontFamily: "var(--mono)",
                letterSpacing: "0.06em",
              }}
            >
              {it.label}
            </div>
            <div
              className="font-medium tabular-nums"
              style={{ fontSize: 22, color: "var(--ink)" }}
            >
              {it.value.toLocaleString("fr-FR")}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .kpi-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 640px) {
          .kpi-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
    >
      <div
        className="text-[10px] uppercase mb-2"
        style={{
          color: "var(--ink-4)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Histo({ data }: { data: { key: string; n: number }[] }) {
  if (data.length === 0) return <Empty />;
  const max = Math.max(...data.map((d) => d.n), 1);
  return (
    <div className="space-y-1">
      {data.map((d) => (
        <div key={d.key} className="flex items-center gap-2">
          <div
            className="text-xs font-medium truncate"
            style={{ width: "40%", color: "var(--ink-3)" }}
            title={d.key}
          >
            {d.key}
          </div>
          <div
            className="flex-1 h-2.5 rounded"
            style={{ background: "var(--ivory-2)" }}
          >
            <div
              className="h-2.5 rounded"
              style={{
                width: `${(d.n / max) * 100}%`,
                background: "var(--accent)",
              }}
            />
          </div>
          <div
            className="text-xs font-semibold tabular-nums"
            style={{ width: 28, textAlign: "right", color: "var(--ink)" }}
          >
            {d.n}
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ label = "Aucune donnée." }: { label?: string }) {
  return (
    <div className="text-xs" style={{ color: "var(--ink-5)" }}>
      {label}
    </div>
  );
}
