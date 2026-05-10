// app/buupp-admin/campagnes/page.tsx
import Link from "next/link";
import { fetchCampaignsKpis } from "@/lib/admin/queries/campaigns";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";

export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("fr-FR");
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function CampaignsAdminPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const raw = sp.period ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw) ? (raw as PeriodKey) : ("30d" as PeriodKey);
  const d = await fetchCampaignsKpis(rangeFor(period, new Date()));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Box label="Créées" value={fmt.format(d.created)} />
        <Box label="Budget €" value={eur.format(d.budgetEur)} />
        <Box label="Dépensé €" value={eur.format(d.spentEur)} />
        <Box label="Consommation moy." value={`${d.consumptionAvgPct}%`} />
        <Box label="CPC moyen €" value={eur.format(d.cpcAvgEur)} />
        <Box label="CPC médian €" value={eur.format(d.cpcMedianEur)} />
        <Box label="Auto-completed" value={fmt.format(d.autoCompleted)} />
        <Box label="Expiry warned" value={fmt.format(d.expiringWarned)} />
      </div>

      <Section title="Par statut"><pre className="text-xs">{JSON.stringify(d.byStatus, null, 2)}</pre></Section>
      <Section title="Par type"><pre className="text-xs">{JSON.stringify(d.byType, null, 2)}</pre></Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section title="Top zones géo"><List items={d.topGeo.map((r) => `${r.geo} (${r.n})`)} /></Section>
        <Section title="Top catégories"><List items={d.topCategories.map((r) => `${r.cat} (${r.n})`)} /></Section>
      </div>

      <Section title="Top 10 perf (>= 5 finals)">
        <ul className="text-sm">
          {d.topPerf.map((c) => (
            <li key={c.id} className="border-b border-neutral-100 py-1 flex justify-between">
              <Link className="underline" href={`/buupp-admin/campagnes/${c.id}`}>{c.name}</Link>
              <span className="tabular-nums">{c.pct}%</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Flop 10 perf (>= 5 finals)">
        <ul className="text-sm">
          {d.flopPerf.map((c) => (
            <li key={c.id} className="border-b border-neutral-100 py-1 flex justify-between">
              <Link className="underline" href={`/buupp-admin/campagnes/${c.id}`}>{c.name}</Link>
              <span className="tabular-nums">{c.pct}%</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{title}</h2><div className="rounded-lg border border-neutral-200 bg-white p-4">{children}</div></section>;
}
function Box({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-neutral-200 bg-white p-3"><div className="text-xs text-neutral-500">{label}</div><div className="text-lg font-semibold tabular-nums">{value}</div></div>;
}
function List({ items }: { items: string[] }) {
  if (items.length === 0) return <div className="text-sm text-neutral-500">Aucune donnée.</div>;
  return <ul className="text-sm">{items.map((s) => <li key={s} className="py-0.5">{s}</li>)}</ul>;
}
