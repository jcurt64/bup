/**
 * Section Prospects du back-office BUUPP : funnel, paliers, scores,
 * vérification, top villes/secteurs, motifs refus, monétisation,
 * founders, parrainage. Toutes les distributions sont globales ; les
 * compteurs périodiques respectent le `?period=`.
 */
import { fetchProspectsKpis } from "@/lib/admin/queries/prospects";
import { PERIOD_KEYS, rangeFor, type PeriodKey } from "@/lib/admin/periods";

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
    ? (raw as PeriodKey) : ("30d" as PeriodKey);
  const data = await fetchProspectsKpis(rangeFor(period, new Date()));

  return (
    <div className="space-y-6">
      <Section title="Funnel d'acquisition (sur la période)">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            ["Waitlist", data.funnel.waitlist],
            ["Signup", data.funnel.signup],
            ["Palier 1", data.funnel.tier1],
            ["Tél vérifié", data.funnel.phone],
            ["1ʳᵉ acceptation", data.funnel.firstAccept],
            ["1ᵉʳ retrait", data.funnel.firstWithdrawal],
          ].map(([label, n]) => (
            <Box key={label as string} label={label as string} value={fmt.format(n as number)} />
          ))}
        </div>
      </Section>

      <Section title="Distribution paliers complétés (global)">
        <Histo data={data.paliers} labelFor={(k) => `${k} paliers`} />
      </Section>

      <Section title="BUUPP score (global)">
        <Histo
          data={data.scoreBuckets}
          labelFor={(k) => {
            const i = Number(k);
            const lo = (i - 1) * 200;
            return `${lo}-${lo + 200}`;
          }}
        />
      </Section>

      <Section title="Vérification (global)">
        <Histo data={data.verification} labelFor={(k) => k} />
        <div className="text-xs text-neutral-500 mt-2">
          Téléphone vérifié : <strong>{data.phoneVerifiedPct}%</strong>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Section title="Top villes (global)">
          <Table rows={data.topVilles.map((r) => [r.ville, fmt.format(r.n)])} />
        </Section>
        <Section title="Top secteurs (global)">
          <Table rows={data.topSecteurs.map((r) => [r.secteur, fmt.format(r.n)])} />
        </Section>
      </div>

      <Section title="Motifs de refus (sur la période)">
        <Table rows={data.refusalReasons.map((r) => [r.reason, fmt.format(r.n)])} />
      </Section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Box label="Crédité prospects" value={eur.format(data.creditedEur)} />
        <Box label="Retraits (count)" value={fmt.format(data.withdrawalsCount)} />
        <Box label="Retraits (€)" value={eur.format(data.withdrawalsEur)} />
        <Box label="Founders" value={fmt.format(data.founders)} />
        <Box label="Bonus founders (count)" value={fmt.format(data.foundersBonusCount)} />
        <Box label="Bonus founders (€)" value={eur.format(data.foundersBonusEur)} />
      </div>

      <Section title="Top parrains (refCode → conversions)">
        <Table rows={data.topReferrers.map((r) => [r.refCode, fmt.format(r.n)])} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{title}</h2>
      <div className="rounded-lg border border-neutral-200 bg-white p-4">{children}</div>
    </section>
  );
}
function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 bg-white p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
function Table({ rows }: { rows: [string, string][] }) {
  if (rows.length === 0) return <div className="text-sm text-neutral-500">Aucune donnée.</div>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-neutral-100 last:border-0">
            <td className="py-1">{k}</td>
            <td className="py-1 text-right tabular-nums">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function Histo({
  data,
  labelFor,
}: {
  data: Record<string, number>;
  labelFor: (k: string) => string;
}) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <div className="text-sm text-neutral-500">Aucune donnée.</div>;
  const max = Math.max(...entries.map(([, n]) => n), 1);
  return (
    <div className="space-y-1">
      {entries.map(([k, n]) => (
        <div key={k} className="flex items-center gap-2">
          <div className="w-24 text-xs text-neutral-600">{labelFor(k)}</div>
          <div className="flex-1 bg-neutral-100 h-3 rounded">
            <div className="bg-neutral-700 h-3 rounded" style={{ width: `${(n / max) * 100}%` }} />
          </div>
          <div className="w-12 text-right text-xs tabular-nums">{n}</div>
        </div>
      ))}
    </div>
  );
}
