/**
 * Vue d'ensemble du back-office BUUPP. Lit la RPC d'overview directement
 * (pas de fetch HTTP rond-trip) puis rend le bandeau KPI.
 *
 * Les 3 timeseries arrivent en Task 2.5.
 */
import { fetchOverviewKpisCached } from "@/lib/admin/queries/overview";
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
    fetchOverviewKpisCached(cur),
    fetchOverviewKpisCached(prev),
  ]);
  const points = await fetchOverviewTimeseries(cur);
  const labels = points.map((pt) => pt.label);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <KpiCard label="Inscrits prospects" icon="users" accent="#6366F1" value={fmtInt(c.prospects)} current={c.prospects} previous={p.prospects} />
        <KpiCard label="Inscrits pros" icon="briefcase" accent="#10B981" value={fmtInt(c.pros)} current={c.pros} previous={p.pros} />
        <KpiCard label="Waitlist" icon="hourglass" accent="#3B82F6" value={fmtInt(c.waitlist)} current={c.waitlist} previous={p.waitlist} />
        <KpiCard label="Campagnes créées" icon="megaphone" accent="#8B5CF6" value={fmtInt(c.campaignsCreated)} current={c.campaignsCreated} previous={p.campaignsCreated} />
        <KpiCard label="Sollicitations envoyées" icon="send" accent="#F59E0B" value={fmtInt(c.relationsSent)} current={c.relationsSent} previous={p.relationsSent} />
        <KpiCard label="Taux d'acceptation" icon="line-chart" accent="#10B981" value={`${c.acceptanceRatePct}`} unit="%" current={c.acceptanceRatePct} previous={p.acceptanceRatePct} />
        <KpiCard label="Budget engagé" icon="wallet" accent="#6366F1" value={fmtEur(c.budgetCents)} current={c.budgetCents} previous={p.budgetCents} />
        <KpiCard label="Dépensé réel" icon="currency" accent="#EC4899" value={fmtEur(c.spentCents)} current={c.spentCents} previous={p.spentCents} />
        <KpiCard label="Crédité prospects" icon="coins" accent="#10B981" value={fmtEur(c.creditedCents)} current={c.creditedCents} previous={p.creditedCents} />
        <KpiCard label="Recharges Stripe" icon="credit-card" accent="#3B82F6" value={fmtEur(c.topupCents)} current={c.topupCents} previous={p.topupCents} />
        <KpiCard label="Revenu BUUPP estimé" icon="trending-up" accent="#F59E0B" value={fmtEur(c.estimatedRevenueCents)} current={c.estimatedRevenueCents} previous={p.estimatedRevenueCents} />
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <TimeseriesChart
          title="Inscriptions"
          icon="activity"
          labels={labels}
          series={[
            { label: "Prospects", values: points.map((pt) => pt.prospects), color: "#3B82F6" },
            { label: "Pros", values: points.map((pt) => pt.pros), color: "#D97706" },
          ]}
        />
        <TimeseriesChart
          title="Sollicitations"
          icon="bar-chart"
          labels={labels}
          series={[
            { label: "Envoyées", values: points.map((pt) => pt.relationsSent), color: "#0F172A" },
            { label: "Acceptées", values: points.map((pt) => pt.relationsAccepted), color: "#10B981" },
            { label: "Refusées", values: points.map((pt) => pt.relationsRefused), color: "#EF4444" },
            { label: "Expirées", values: points.map((pt) => pt.relationsExpired), color: "#94A3B8", dashed: true },
          ]}
        />
        <TimeseriesChart
          title="Money flow (€)"
          icon="euro"
          labels={labels}
          series={[
            { label: "Budget", values: points.map((pt) => pt.budgetCents / 100), color: "#8B5CF6" },
            { label: "Dépensé", values: points.map((pt) => pt.spentCents / 100), color: "#3B82F6" },
            { label: "Crédité prospects", values: points.map((pt) => pt.creditedCents / 100), color: "#10B981" },
          ]}
        />
      </section>
      </div>
      <aside><LiveFeed /></aside>
    </div>
  );
}
