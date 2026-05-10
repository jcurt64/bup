/**
 * Vue d'ensemble du back-office BUUPP. Lit la RPC d'overview directement
 * (pas de fetch HTTP rond-trip) puis rend le bandeau KPI.
 *
 * Les 3 timeseries arrivent en Task 2.5.
 */
import { fetchOverviewKpis } from "@/lib/admin/queries/overview";
import { fetchOverviewTimeseries } from "@/lib/admin/queries/overview-timeseries";
import {
  PERIOD_KEYS,
  rangeFor,
  previousRangeOf,
  type PeriodKey,
} from "@/lib/admin/periods";
import KpiCard from "./_components/KpiCard";
import TimeseriesChart from "./_components/TimeseriesChart";
import LiveFeed from "./_components/LiveFeed";

export const dynamic = "force-dynamic";

function fmtInt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}
function fmtEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.period ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as PeriodKey)
    : ("30d" as PeriodKey);

  const now = new Date();
  const cur = rangeFor(period, now);
  const prev = previousRangeOf(cur);
  const [c, p] = await Promise.all([
    fetchOverviewKpis(cur),
    fetchOverviewKpis(prev),
  ]);
  const points = await fetchOverviewTimeseries(cur);
  const labels = points.map((pt) => pt.label);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Inscrits prospects" value={fmtInt(c.prospects)} current={c.prospects} previous={p.prospects} />
        <KpiCard label="Inscrits pros" value={fmtInt(c.pros)} current={c.pros} previous={p.pros} />
        <KpiCard label="Waitlist" value={fmtInt(c.waitlist)} current={c.waitlist} previous={p.waitlist} />
        <KpiCard label="Campagnes actives" value={fmtInt(c.activeCampaigns)} current={c.activeCampaigns} previous={p.activeCampaigns} />
        <KpiCard label="Sollicitations envoyées" value={fmtInt(c.relationsSent)} current={c.relationsSent} previous={p.relationsSent} />
        <KpiCard label="Taux d'acceptation" value={`${c.acceptanceRatePct}`} unit="%" current={c.acceptanceRatePct} previous={p.acceptanceRatePct} />
        <KpiCard label="Budget engagé" value={fmtEur(c.budgetCents)} current={c.budgetCents} previous={p.budgetCents} />
        <KpiCard label="Dépensé réel" value={fmtEur(c.spentCents)} current={c.spentCents} previous={p.spentCents} />
        <KpiCard label="Crédité prospects" value={fmtEur(c.creditedCents)} current={c.creditedCents} previous={p.creditedCents} />
        <KpiCard label="Recharges Stripe" value={fmtEur(c.topupCents)} current={c.topupCents} previous={p.topupCents} />
        <KpiCard label="Revenu BUUPP estimé" value={fmtEur(c.estimatedRevenueCents)} current={c.estimatedRevenueCents} previous={p.estimatedRevenueCents} />
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <TimeseriesChart
          title="Inscriptions"
          labels={labels}
          series={[
            { label: "Prospects", values: points.map((pt) => pt.prospects), color: "#0ea5e9" },
            { label: "Pros", values: points.map((pt) => pt.pros), color: "#f59e0b" },
          ]}
        />
        <TimeseriesChart
          title="Sollicitations"
          labels={labels}
          series={[
            { label: "Envoyées", values: points.map((pt) => pt.relationsSent), color: "#64748b" },
            { label: "Acceptées", values: points.map((pt) => pt.relationsAccepted), color: "#10b981" },
            { label: "Refusées", values: points.map((pt) => pt.relationsRefused), color: "#ef4444" },
            { label: "Expirées", values: points.map((pt) => pt.relationsExpired), color: "#a3a3a3" },
          ]}
        />
        <TimeseriesChart
          title="Money flow (€)"
          labels={labels}
          series={[
            { label: "Budget", values: points.map((pt) => pt.budgetCents / 100), color: "#7c3aed" },
            { label: "Dépensé", values: points.map((pt) => pt.spentCents / 100), color: "#0ea5e9" },
            { label: "Crédité prospects", values: points.map((pt) => pt.creditedCents / 100), color: "#10b981" },
          ]}
        />
      </section>
      </div>
      <aside><LiveFeed /></aside>
    </div>
  );
}
