/**
 * Vue d'ensemble du back-office BUUPP. Lit la RPC d'overview directement
 * (pas de fetch HTTP rond-trip) puis rend le bandeau KPI.
 *
 * Les 3 timeseries arrivent en Task 2.5.
 */
import { fetchOverviewKpis } from "@/lib/admin/queries/overview";
import {
  PERIOD_KEYS,
  rangeFor,
  previousRangeOf,
  type PeriodKey,
} from "@/lib/admin/periods";
import KpiCard from "./_components/KpiCard";

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

  return (
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
      <section className="text-sm text-neutral-600">
        Les 3 timeseries (inscriptions / sollicitations / money flow) arrivent en Task 2.5.
      </section>
    </div>
  );
}
