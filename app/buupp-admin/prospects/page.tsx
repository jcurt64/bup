/**
 * Section Prospects du back-office BUUPP : funnel, paliers, scores,
 * vérification, top villes/secteurs, motifs refus, monétisation,
 * founders, parrainage, liste filtrable. Refonte visuelle alignée sur
 * la maquette `public/prototype/poo.png` (cartes claires, pastilles
 * d'icônes colorées, barres dégradées, pastilles de statut).
 *
 * Toutes les distributions sont globales ; les compteurs périodiques
 * respectent le `?period=`.
 */
import { fetchProspectsKpis } from "@/lib/admin/queries/prospects";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";
import AdminIcon, { type AdminIconName } from "../_components/AdminIcon";
import KpiCard from "../_components/KpiCard";
import ProspectsTable from "../_components/ProspectsTable";

export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("fr-FR");
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function ProspectsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.period ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey)
    : ("30d" as PeriodKey);
  const data = await fetchProspectsKpis(rangeFor(period, new Date()));

  // ─── Funnel ───────────────────────────────────────────────────────
  const f = data.funnel;
  const funnelSteps: { label: string; icon: AdminIconName; accent: string; n: number }[] = [
    { label: "Waitlist", icon: "hourglass", accent: "#3B82F6", n: f.waitlist },
    { label: "Signup", icon: "user-plus", accent: "#10B981", n: f.signup },
    { label: "Palier 1", icon: "layers", accent: "#8B5CF6", n: f.tier1 },
    { label: "Tél vérifié", icon: "badge-check", accent: "#10B981", n: f.phone },
    { label: "1ʳᵉ acceptation", icon: "check", accent: "#8B5CF6", n: f.firstAccept },
    { label: "1ᵉʳ retrait", icon: "wallet", accent: "#F59E0B", n: f.firstWithdrawal },
  ];
  const funnelMax = Math.max(...funnelSteps.map((s) => s.n), 1);

  // ─── Score buckets (couleur par tranche) ──────────────────────────
  const scoreColor = (bucketKey: string): string => {
    const lo = (Number(bucketKey) - 1) * 200;
    if (lo >= 800) return "#10B981";
    if (lo >= 600) return "#8B5CF6";
    return "#D4A017";
  };

  const VERIF_COLOR: Record<string, string> = {
    basique: "#94A3B8",
    certifie_confiance: "#10B981",
    verifie: "#3B82F6",
  };

  return (
    <div className="space-y-7">
      {/* ─── Funnel d'acquisition ─────────────────────────────────── */}
      <section>
        <SectionHead icon="filter" accent="#10B981" title="Funnel d'acquisition" suffix="sur la période" />
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
            {funnelSteps.map((s, i) => {
              const prev = i > 0 ? funnelSteps[i - 1].n : null;
              const pct = prev && prev > 0 ? Math.round((s.n / prev) * 100) : null;
              return (
                <div
                  key={s.label}
                  className={`px-4 py-1 ${i !== 0 ? "xl:border-l" : ""}`}
                  style={{ borderColor: "var(--line)" }}
                >
                  <span
                    className="inline-flex items-center justify-center rounded-[10px] mb-3"
                    style={{
                      width: 34,
                      height: 34,
                      background: `color-mix(in oklab, ${s.accent} 14%, var(--paper))`,
                      color: s.accent,
                    }}
                  >
                    <AdminIcon name={s.icon} size={18} />
                  </span>
                  <div
                    className="text-[11px] font-bold uppercase mb-1"
                    style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.08em" }}
                  >
                    {s.label}
                  </div>
                  <div
                    className="tabular-nums mb-2.5"
                    style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 500, color: "var(--ink)", lineHeight: 1 }}
                  >
                    {fmt.format(s.n)}
                  </div>
                  <div className="h-1.5 rounded-full w-full" style={{ background: "var(--ivory-2)" }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.round((s.n / funnelMax) * 100)}%`,
                        background: s.accent,
                      }}
                    />
                  </div>
                  {pct != null && (
                    <div
                      className="mt-1.5 text-[11px] tabular-nums"
                      style={{ color: pct > 100 ? "var(--good)" : "var(--ink-4)", fontFamily: "var(--mono)" }}
                    >
                      {pct}% {pct > 100 ? "↑" : "↓"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* ─── Paliers complétés + BUUPP score ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-7">
        <section>
          <SectionHead icon="layers" accent="#8B5CF6" title="Distribution paliers complétés" suffix="global" />
          <Card>
            <BarList
              entries={sortedEntries(data.paliers)}
              labelFor={(k) => `${k} palier${Number(k) > 1 ? "s" : ""}`}
              color="#4F46E5"
            />
          </Card>
        </section>

        <section>
          <SectionHead icon="star" accent="#8B5CF6" title="BUUPP score" suffix="global" />
          <Card>
            <BarList
              entries={sortedEntries(data.scoreBuckets)}
              labelFor={(k) => {
                const lo = (Number(k) - 1) * 200;
                return `${lo} – ${lo + 200}`;
              }}
              colorFor={scoreColor}
            />
          </Card>
        </section>
      </div>

      {/* ─── Vérification + Motifs de refus ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-7">
        <section>
          <SectionHead icon="shield" accent="#10B981" title="Vérification" suffix="global" />
          <Card>
            <BarList
              entries={sortedEntries(data.verification)}
              labelFor={(k) => k}
              colorFor={(k) => VERIF_COLOR[k] ?? "#94A3B8"}
            />
            <div className="mt-3 text-xs" style={{ color: "var(--ink-4)" }}>
              Téléphone vérifié :{" "}
              <strong style={{ color: "var(--good)" }}>{data.phoneVerifiedPct}%</strong>
            </div>
          </Card>
        </section>

        <section>
          <SectionHead icon="flag" accent="#EC4899" title="Motifs de refus" suffix="sur la période" />
          <Card>
            {data.refusalReasons.length === 0 ? (
              <EmptyState text="Aucune donnée sur cette période." />
            ) : (
              <BarList
                entries={data.refusalReasons.map((r) => [r.reason, r.n] as [string, number])}
                labelFor={(k) => k}
                color="#EC4899"
              />
            )}
          </Card>
        </section>
      </div>

      {/* ─── Top villes + Top secteurs ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-7">
        <section>
          <SectionHead icon="map-pin" accent="#3B82F6" title="Top villes" suffix="global" />
          <Card>
            <RankList rows={data.topVilles.map((r) => ({ name: r.ville, n: r.n }))} />
          </Card>
        </section>

        <section>
          <SectionHead icon="briefcase" accent="#10B981" title="Top secteurs" suffix="global" />
          <Card>
            <RankList rows={data.topSecteurs.map((r) => ({ name: r.secteur, n: r.n }))} />
          </Card>
        </section>
      </div>

      {/* ─── Crédits, retraits & founders ─────────────────────────── */}
      <section>
        <SectionHead icon="currency" accent="#F59E0B" title="Crédits, retraits & founders" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <KpiCard hideDelta icon="coins" accent="#10B981" label="Crédité prospects" value={eur.format(data.creditedEur)} />
          <KpiCard hideDelta icon="download" accent="#3B82F6" label="Retraits (count)" value={fmt.format(data.withdrawalsCount)} />
          <KpiCard hideDelta icon="credit-card" accent="#3B82F6" label="Retraits (€)" value={eur.format(data.withdrawalsEur)} />
          <KpiCard hideDelta icon="star" accent="#F59E0B" label="Founders" value={fmt.format(data.founders)} />
          <KpiCard hideDelta icon="gift" accent="#8B5CF6" label="Bonus founders (count)" value={fmt.format(data.foundersBonusCount)} />
          <KpiCard hideDelta icon="badge-check" accent="#8B5CF6" label="Bonus founders (€)" value={eur.format(data.foundersBonusEur)} />
        </div>
      </section>

      {/* ─── Top parrains ─────────────────────────────────────────── */}
      <section>
        <SectionHead icon="user-plus" accent="#10B981" title="Top parrains" suffix="refcode → conversions" />
        <Card>
          {data.topReferrers.length === 0 ? (
            <EmptyState text="Aucun parrainage sur cette période." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {data.topReferrers.map((r) => (
                <div
                  key={r.refCode}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5"
                  style={{ background: "var(--ivory-2)", border: "1px solid var(--line)" }}
                >
                  <span
                    className="font-bold truncate"
                    style={{ fontFamily: "var(--mono)", color: "var(--ink-2)", fontSize: 13, letterSpacing: "0.04em" }}
                  >
                    {r.refCode}
                  </span>
                  <span
                    className="shrink-0 inline-flex items-center justify-center rounded-full tabular-nums"
                    style={{
                      minWidth: 22,
                      height: 19,
                      padding: "0 6px",
                      fontSize: 10.5,
                      fontWeight: 700,
                      fontFamily: "var(--mono)",
                      background: "color-mix(in oklab, #6366F1 15%, var(--paper))",
                      color: "#4338CA",
                    }}
                  >
                    {r.n}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* ─── Liste prospects ──────────────────────────────────────── */}
      <section>
        <SectionHead icon="users" accent="#10B981" title="Liste prospects" suffix="filtrable — ville, score, période, tri" />
        <Card>
          <ProspectsTable />
        </Card>
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
  suffix,
}: {
  icon: AdminIconName;
  accent: string;
  title: string;
  suffix?: string;
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
      {suffix && (
        <span
          className="text-[11px]"
          style={{ color: "var(--ink-5)", fontFamily: "var(--mono)", letterSpacing: "0.04em" }}
        >
          {suffix}
        </span>
      )}
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-2 text-sm" style={{ color: "var(--ink-4)" }}>
      <span
        className="inline-flex items-center justify-center rounded-full shrink-0"
        style={{ width: 22, height: 22, border: "1.5px solid var(--line-2)", color: "var(--ink-5)" }}
        aria-hidden
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
      {text}
    </div>
  );
}

function sortedEntries(rec: Record<string, number>): [string, number][] {
  return Object.entries(rec).sort(([a], [b]) => a.localeCompare(b, "fr", { numeric: true }));
}

function BarList({
  entries,
  labelFor,
  color,
  colorFor,
}: {
  entries: [string, number][];
  labelFor: (k: string) => string;
  color?: string;
  colorFor?: (k: string) => string;
}) {
  if (entries.length === 0) return <EmptyState text="Aucune donnée." />;
  const max = Math.max(...entries.map(([, n]) => n), 1);
  return (
    <div className="space-y-2.5">
      {entries.map(([k, n]) => {
        const c = colorFor ? colorFor(k) : color ?? "#4F46E5";
        return (
          <div key={k} className="flex items-center gap-3">
            <div
              className="w-28 sm:w-32 shrink-0 text-[13px] truncate"
              style={{ color: "var(--ink-2)" }}
            >
              {labelFor(k)}
            </div>
            <div className="flex-1 h-3 rounded-full" style={{ background: "var(--ivory-2)" }}>
              <div
                className="h-3 rounded-full"
                style={{
                  width: `${Math.max((n / max) * 100, n > 0 ? 6 : 0)}%`,
                  background: `linear-gradient(90deg, color-mix(in oklab, ${c} 78%, white), ${c})`,
                }}
              />
            </div>
            <div
              className="w-8 text-right tabular-nums font-bold shrink-0"
              style={{ color: "var(--ink)", fontSize: 14 }}
            >
              {fmt.format(n)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankList({ rows }: { rows: { name: string; n: number }[] }) {
  if (rows.length === 0) return <EmptyState text="Aucune donnée." />;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <div className="flex flex-col">
      {rows.map((r, i) => {
        const top = i === 0;
        return (
          <div
            key={`${r.name}-${i}`}
            className="flex items-center gap-3 py-2.5"
            style={{ borderTop: i === 0 ? undefined : "1px solid var(--line)" }}
          >
            <span
              className="inline-flex items-center justify-center rounded-md shrink-0 tabular-nums"
              style={{
                width: 24,
                height: 24,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "var(--mono)",
                background: top ? "#6366F1" : "var(--ivory-2)",
                color: top ? "var(--paper)" : "var(--ink-4)",
              }}
            >
              {i + 1}
            </span>
            <span className="flex-1 truncate text-[13.5px]" style={{ color: "var(--ink-2)" }}>
              {r.name}
            </span>
            <div className="w-24 sm:w-32 h-2 rounded-full shrink-0" style={{ background: "var(--ivory-2)" }}>
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.max((r.n / max) * 100, r.n > 0 ? 8 : 0)}%`,
                  background: "linear-gradient(90deg,#6366F1,#4F46E5)",
                }}
              />
            </div>
            <span
              className="w-6 text-right tabular-nums font-bold shrink-0"
              style={{ color: "var(--ink)", fontSize: 14 }}
            >
              {fmt.format(r.n)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
