/**
 * /buupp-admin/signalements — Page admin des signalements pros par les
 * prospects. Filtres GET (statut / motif / période), KPI top, liste de
 * cartes ReportCard, pagination simple.
 */

import {
  fetchReportsList,
  fetchReportsKpis,
  enrichReportsWithProEmails,
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

  const [itemsRaw, kpis] = await Promise.all([
    fetchReportsList({ status, reason, period, page }),
    fetchReportsKpis({ period }),
  ]);
  const items = await enrichReportsWithProEmails(itemsRaw);

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
          Anti-fraude · Pros
        </div>
        <h1 className="text-xl font-medium" style={{ letterSpacing: "-0.01em" }}>
          Signalements de professionnels
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-3)", maxWidth: 720 }}>
          Liste des signalements envoyés par les prospects depuis la modale de
          mise en relation. Trois motifs possibles : sollicitation multiple,
          faux compte, échange abusif. Marque un signalement « traité » quand
          tu as vérifié et tranché.
        </p>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="À traiter" value={kpis.open} />
        <Kpi label="Traités 30 j" value={kpis.resolved30d} />
        <Kpi label={`Total ${periodLabel(period)}`} value={kpis.totalPeriod} />
        <div
          className="rounded-lg p-4 flex flex-col gap-1"
          style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
        >
          <div
            className="text-[11px] uppercase"
            style={{
              color: "var(--ink-4)",
              fontFamily: "var(--mono)",
              letterSpacing: "0.06em",
            }}
          >
            Répartition motifs
          </div>
          <div className="flex flex-wrap gap-2 mt-1 text-xs">
            <span>Multi: {kpis.byReason.sollicitation_multiple}</span>
            <span>Faux: {kpis.byReason.faux_compte}</span>
            <span>Abus: {kpis.byReason.echange_abusif}</span>
          </div>
        </div>
      </section>

      {/* Filtres */}
      <form
        method="GET"
        className="flex flex-wrap gap-2 items-end"
        style={{ color: "var(--ink-3)" }}
      >
        <Select name="status" value={status} options={STATUS_OPTIONS} label="Statut" />
        <Select name="reason" value={reason} options={REASON_OPTIONS} label="Motif" />
        <Select name="period" value={period} options={PERIOD_OPTIONS} label="Période" />
        <button
          type="submit"
          className="text-xs rounded px-3 py-1.5 cursor-pointer"
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
      className="rounded-lg p-4"
      style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
    >
      <div
        className="text-[11px] uppercase mb-1"
        style={{
          color: "var(--ink-4)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div className="text-2xl" style={{ fontFamily: "var(--serif)" }}>
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
        className="text-[10px] uppercase"
        style={{
          color: "var(--ink-4)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="text-sm rounded px-2 py-1.5"
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
