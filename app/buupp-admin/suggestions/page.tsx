/**
 * /buupp-admin/suggestions — triage des suggestions utilisateurs.
 * Filtres GET (statut / période), KPI, liste SuggestionCard, pagination.
 */

import {
  fetchSuggestionsList,
  fetchSuggestionsKpis,
  type SuggestionListItem,
  type SuggestionStatus,
  type SuggestionPeriod,
} from "@/lib/admin/queries/suggestions";
import SuggestionCard from "./_components/SuggestionCard";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<{ value: SuggestionStatus; label: string }> = [
  { value: "unread", label: "Non lues" },
  { value: "resolved", label: "Résolues" },
  { value: "all", label: "Toutes" },
];
const PERIOD_OPTIONS: Array<{ value: SuggestionPeriod; label: string }> = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "all", label: "Tout" },
];

function asStatus(v: string | undefined): SuggestionStatus {
  if (v === "resolved" || v === "all") return v;
  return "unread";
}
function asPeriod(v: string | undefined): SuggestionPeriod {
  if (v === "7d" || v === "90d" || v === "all") return v;
  return "30d";
}
function buildHref(o: {
  status: SuggestionStatus;
  period: SuggestionPeriod;
  page: number;
}): string {
  const u = new URLSearchParams();
  u.set("status", o.status);
  u.set("period", o.period);
  if (o.page > 0) u.set("page", String(o.page));
  return `/buupp-admin/suggestions?${u.toString()}`;
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

export default async function SuggestionsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; period?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = asStatus(sp.status);
  const period = asPeriod(sp.period);
  const pageRaw = Number(sp.page ?? "0");
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;

  const [items, kpis] = await Promise.all([
    fetchSuggestionsList({ status, period, page }),
    fetchSuggestionsKpis({ period }),
  ]);

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
          Retours utilisateurs
        </div>
        <h1 className="text-xl font-medium" style={{ letterSpacing: "-0.01em" }}>
          Suggestions
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-3)", maxWidth: 720 }}>
          Messages envoyés depuis l&apos;onglet « Vos suggestions » des
          dashboards prospect et pro. Marque une suggestion « lue » puis
          « résolue » quand tu l&apos;as traitée.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Non lues" value={kpis.unread} />
        <Kpi label="Résolues" value={kpis.resolved} />
        <Kpi label="Total période" value={kpis.totalPeriod} />
        <Kpi label="E-mail échoué" value={kpis.emailFailed} />
      </section>

      <form
        method="GET"
        className="flex flex-wrap gap-2 items-end"
        style={{ color: "var(--ink-3)" }}
      >
        <Select name="status" value={status} options={STATUS_OPTIONS} label="Statut" />
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

      <RoleSplitSection items={items} />


      <nav className="flex justify-between items-center text-xs">
        {page > 0 ? (
          <a
            href={buildHref({ status, period, page: page - 1 })}
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
            href={buildHref({ status, period, page: page + 1 })}
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

/** Sépare la liste en deux sections distinctes (Prospects · Pros), avec
 *  un compteur dans chaque en-tête et un état vide local par section.
 *  Les suggestions dont le rôle n'a pas pu être résolu (utilisateurs ni
 *  pro ni prospect côté DB) tombent dans une 3e section facultative. */
function RoleSplitSection({ items }: { items: SuggestionListItem[] }) {
  const prospects = items.filter((s) => s.fromRole === "prospect");
  const pros = items.filter((s) => s.fromRole === "pro");
  const others = items.filter(
    (s) => s.fromRole !== "prospect" && s.fromRole !== "pro",
  );

  if (items.length === 0) {
    return (
      <section className="space-y-3">
        <div
          className="rounded-lg p-6 text-center text-sm"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            color: "var(--ink-3)",
          }}
        >
          Aucune suggestion pour ces filtres.
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <RoleGroup title="Prospects" count={prospects.length} items={prospects} />
      <RoleGroup title="Pros" count={pros.length} items={pros} />
      {others.length > 0 && (
        <RoleGroup
          title="Rôle non identifié"
          count={others.length}
          items={others}
        />
      )}
    </div>
  );
}

function RoleGroup({
  title,
  count,
  items,
}: {
  title: string;
  count: number;
  items: SuggestionListItem[];
}) {
  return (
    <section className="space-y-3">
      <h2
        className="flex items-baseline gap-3"
        style={{ fontFamily: "var(--serif)", letterSpacing: "-0.01em" }}
      >
        <span className="text-lg" style={{ color: "var(--ink)" }}>
          {title}
        </span>
        <span
          className="text-xs"
          style={{
            color: "var(--ink-4)",
            fontFamily: "var(--mono)",
            letterSpacing: "0.06em",
          }}
        >
          {count} {count === 1 ? "suggestion" : "suggestions"}
        </span>
      </h2>
      {items.length === 0 ? (
        <div
          className="rounded-lg p-4 text-center text-xs"
          style={{
            background: "var(--paper)",
            border: "1px dashed var(--line)",
            color: "var(--ink-4)",
          }}
        >
          Aucune suggestion {title.toLowerCase()} pour ces filtres.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <SuggestionCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </section>
  );
}
