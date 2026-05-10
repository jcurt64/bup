// app/buupp-admin/pros/page.tsx
import { fetchProsKpis } from "@/lib/admin/queries/pros";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";
import ProsTable from "../_components/ProsTable";

export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("fr-FR");
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export default async function ProsAdminPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const raw = sp.period ?? "30d";
  const period = (PERIOD_KEYS as readonly string[]).includes(raw) ? (raw as PeriodKey) : ("30d" as PeriodKey);
  const data = await fetchProsKpis(rangeFor(period, new Date()));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Box label="Signups (période)" value={fmt.format(data.signups)} />
        <Box label="Recharges (count)" value={fmt.format(data.topupCount)} />
        <Box label="Recharges (€)" value={eur.format(data.topupEur)} />
        <Box label="Panier moyen (€)" value={eur.format(data.topupAvgEur)} />
        <Box label="Wallet cumulé (€)" value={eur.format(data.walletBalanceEur)} />
        <Box label="Reveals contact" value={fmt.format(data.revealsCount)} />
      </div>

      <Section title="Plans">
        <pre className="text-xs">{JSON.stringify(data.byPlan, null, 2)}</pre>
      </Section>
      <Section title="Statuts billing">
        <pre className="text-xs">{JSON.stringify(data.byBilling, null, 2)}</pre>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section title="Top secteurs"><Table rows={data.topSecteurs.map((r) => [r.secteur, fmt.format(r.n)])} /></Section>
        <Section title="Top villes"><Table rows={data.topVilles.map((r) => [r.ville, fmt.format(r.n)])} /></Section>
      </div>

      <Section title="Liste pros (50 plus récents)"><ProsTable /></Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{title}</h2><div className="rounded-lg border border-neutral-200 bg-white p-4">{children}</div></section>;
}
function Box({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-neutral-200 bg-white p-3"><div className="text-xs text-neutral-500">{label}</div><div className="text-lg font-semibold tabular-nums">{value}</div></div>;
}
function Table({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) return <div className="text-sm text-neutral-500">Aucune donnée.</div>;
  return <table className="w-full text-sm"><tbody>{rows.map(([k, v]) => (<tr key={k} className="border-b border-neutral-100"><td className="py-1">{k}</td><td className="py-1 text-right tabular-nums">{v}</td></tr>))}</tbody></table>;
}
