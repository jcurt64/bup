/**
 * /buupp-admin/signalements — Page admin des signalements pros par les
 * prospects. Filtres GET (statut / motif / période), KPI top, liste de
 * cartes ReportCard, pagination simple.
 */

import {
  fetchReportsList,
  fetchReportsKpis,
  type ReportStatus,
  type ReportReason,
  type ReportPeriod,
} from "@/lib/admin/queries/reports";
import ReportCard from "./_components/ReportCard";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<{ value: ReportStatus; label: string }> = [
  { value: "open", label: "À traiter" },
  { value: "resolved", label: "Traités" },
  { value: "all", label: "Tous" },
];
const REASON_OPTIONS: Array<{ value: ReportReason; label: string }> = [
  { value: "all", label: "Tous motifs" },
  { value: "sollicitation_multiple", label: "Sollicitation multiple" },
  { value: "faux_compte", label: "Faux compte" },
  { value: "echange_abusif", label: "Échange abusif" },
];
const PERIOD_OPTIONS: Array<{ value: ReportPeriod; label: string }> = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "all", label: "Tout" },
];

function asStatus(v: string | undefined): ReportStatus {
  if (v === "resolved" || v === "all") return v;
  return "open";
}
function asReason(v: string | undefined): ReportReason {
  if (
    v === "sollicitation_multiple" ||
    v === "faux_compte" ||
    v === "echange_abusif"
  ) {
    return v;
  }
  return "all";
}
function asPeriod(v: string | undefined): ReportPeriod {
  if (v === "7d" || v === "90d" || v === "all") return v;
  return "30d";
}

export default async function SignalementsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    reason?: string;
    period?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = asStatus(sp.status);
  const reason = asReason(sp.reason);
  const period = asPeriod(sp.period);
  const pageRaw = Number(sp.page ?? "0");
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;

  const [items, kpis] = await Promise.all([
    fetchReportsList({ status, reason, period, page }),
    fetchReportsKpis({ period }),
  ]);

  return (
    <div className="space-y-7">
      {/* Intro éditoriale */}
      <header className="space-y-2 max-w-3xl">
        <div
          className="text-[11px] font-bold uppercase"
          style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.14em" }}
        >
          Anti-fraude · Pros
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
          Signalements de professionnels
        </h2>
        <p className="text-sm" style={{ color: "var(--ink-3)", lineHeight: 1.6 }}>
          Liste des signalements envoyés par les prospects depuis la modale de
          mise en relation. Trois motifs possibles : sollicitation multiple,
          faux compte, échange abusif. Marque un signalement « traité » quand
          tu as vérifié et tranché.
        </p>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="À traiter" value={kpis.open} />
        <Kpi label="Traités 30 j" value={kpis.resolved30d} />
        <Kpi label={`Total ${periodLabel(period)}`} value={kpis.totalPeriod} />
        <div
          className="rounded-xl p-4 sm:p-[18px] flex flex-col gap-2"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <div
            className="text-[11px] font-bold uppercase"
            style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.08em" }}
          >
            Répartition motifs
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
            <span>Multi: <strong>{kpis.byReason.sollicitation_multiple}</strong></span>
            <span>Faux: <strong>{kpis.byReason.faux_compte}</strong></span>
            <span>Abus: <strong>{kpis.byReason.echange_abusif}</strong></span>
          </div>
        </div>
      </section>

      {/* Filtres */}
      <form
        method="GET"
        className="flex flex-wrap gap-3 items-end"
        style={{ color: "var(--ink-3)" }}
      >
        <Select name="status" value={status} options={STATUS_OPTIONS} label="Statut" />
        <Select name="reason" value={reason} options={REASON_OPTIONS} label="Motif" />
        <Select name="period" value={period} options={PERIOD_OPTIONS} label="Période" />
        <button
          type="submit"
          className="text-sm font-medium rounded-md px-4 py-2.5 cursor-pointer transition-colors"
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            border: "1px solid var(--ink)",
          }}
        >
          Filtrer
        </button>
      </form>

      {/* Liste */}
      <section className="space-y-3">
        {items.length === 0 ? (
          <div
            className="rounded-lg p-6 text-center text-sm"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              color: "var(--ink-3)",
            }}
          >
            Aucun signalement pour ces filtres.
          </div>
        ) : (
          items.map((r) => <ReportCard key={r.id} report={r} />)
        )}
      </section>

      {/* Pagination */}
      <nav className="flex justify-between items-center text-xs">
        {page > 0 ? (
          <a
            href={buildHref({ status, reason, period, page: page - 1 })}
            className="underline"
            style={{ color: "var(--ink)" }}
          >
            ← Page précédente
          </a>
        ) : (
          <span />
        )}
        {items.length === 50 && (
          <a
            href={buildHref({ status, reason, period, page: page + 1 })}
            className="underline"
            style={{ color: "var(--ink)" }}
          >
            Page suivante →
          </a>
        )}
      </nav>
    </div>
  );
}

function periodLabel(p: ReportPeriod): string {
  return p === "7d"
    ? "7 j"
    : p === "30d"
      ? "30 j"
      : p === "90d"
        ? "90 j"
        : "tout";
}

function buildHref(o: {
  status: ReportStatus;
  reason: ReportReason;
  period: ReportPeriod;
  page: number;
}): string {
  const u = new URLSearchParams();
  u.set("status", o.status);
  u.set("reason", o.reason);
  u.set("period", o.period);
  if (o.page > 0) u.set("page", String(o.page));
  return `/buupp-admin/signalements?${u.toString()}`;
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-xl p-4 sm:p-[18px] flex flex-col gap-2"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      <div
        className="text-[11px] font-bold uppercase"
        style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.08em" }}
      >
        {label}
      </div>
      <div
        className="tabular-nums"
        style={{
          fontFamily: "var(--serif)",
          fontSize: 30,
          lineHeight: 1,
          fontWeight: 500,
          color: "var(--ink)",
          letterSpacing: "-0.02em",
        }}
      >
        {new Intl.NumberFormat("fr-FR").format(value)}
      </div>
    </div>
  );
}

function Select<T extends string>({
  name,
  value,
  options,
  label,
}: {
  name: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[10px] font-bold uppercase"
        style={{
          color: "var(--ink-3)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="admin-select text-sm rounded-md px-3 py-2.5 cursor-pointer"
        style={{
          background: "var(--paper)",
          color: "var(--ink)",
          border: "1px solid var(--line)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
