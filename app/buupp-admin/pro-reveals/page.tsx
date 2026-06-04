/**
 * /buupp-admin/pro-reveals — Historique des consultations de données
 * prospect par les pros (table pro_contact_reveals).
 *
 * Liste filtrable (type de champ, période, pagination) + KPIs, dont la
 * détection des « accès répétés » : un même pro qui ouvre le détail d'un
 * même prospect ≥ 3 fois en 24 h (seuil aligné sur le mail de transparence
 * envoyé au prospect, cf. lib/pro/reveal-alert.ts).
 */
import Link from "next/link";
import {
  fetchProRevealsList,
  fetchProRevealsKpis,
  type ProRevealsFilters,
} from "@/lib/admin/queries/pro-reveals";

export const dynamic = "force-dynamic";

const FIELD_OPTIONS: Array<{ value: ProRevealsFilters["field"]; label: string }> = [
  { value: "all", label: "Tout" },
  { value: "details", label: "Détail complet" },
  { value: "email", label: "E-mail" },
  { value: "telephone", label: "Téléphone" },
  { value: "name", label: "Nom" },
];

const PERIOD_OPTIONS: Array<{ value: ProRevealsFilters["period"]; label: string }> = [
  { value: "24h", label: "24 heures" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "all", label: "Tout" },
];

const FIELD_LABEL: Record<string, string> = {
  details: "Détail complet",
  email: "E-mail",
  telephone: "Téléphone",
  name: "Nom complet",
};

function asField(v: string | undefined): ProRevealsFilters["field"] {
  if (v === "details" || v === "email" || v === "telephone" || v === "name") return v;
  return "all";
}
function asPeriod(v: string | undefined): ProRevealsFilters["period"] {
  if (v === "24h" || v === "7d" || v === "90d" || v === "all") return v;
  return "30d";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default async function ProRevealsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ field?: string; period?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const field = asField(sp.field);
  const period = asPeriod(sp.period);
  const pageRaw = Number(sp.page ?? "0");
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;

  const [items, kpis] = await Promise.all([
    fetchProRevealsList({ field, period, page }),
    fetchProRevealsKpis({ period }),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div
          className="text-[11px] uppercase"
          style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
        >
          Anti-fraude · RGPD
        </div>
        <h1 className="text-xl font-medium" style={{ letterSpacing: "-0.01em" }}>
          Consultations de données
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-3)", maxWidth: 720 }}>
          Chaque fois qu&apos;un pro ouvre le détail d&apos;un prospect ou révèle
          un champ (e-mail, téléphone, nom), l&apos;accès est journalisé ici. La
          carte «&nbsp;Accès répétés&nbsp;» signale les pros qui ouvrent le détail
          d&apos;un même prospect au moins {kpis.repeatThreshold} fois en 24&nbsp;h
          — cas où le pro reçoit automatiquement un e-mail de rappel du cadre
          d&apos;usage des données.
        </p>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Consultations" value={kpis.totalReveals} hint="sur la période" />
        <Kpi label="Ouvertures de détail" value={kpis.totalDetails} hint="sur la période" />
        <Kpi
          label="Accès répétés (24h)"
          value={kpis.repeatedPairs}
          alert={kpis.repeatedPairs > 0}
          hint={`≥ ${kpis.repeatThreshold} ouvertures détail / même prospect`}
        />
      </section>

      {/* Filtres */}
      <form method="GET" className="flex flex-wrap gap-2 items-end">
        <Select name="field" value={field} options={FIELD_OPTIONS} label="Type" />
        <Select name="period" value={period} options={PERIOD_OPTIONS} label="Période" />
        <button
          type="submit"
          className="text-xs rounded px-3 py-1.5 cursor-pointer"
          style={{ background: "var(--ink)", color: "var(--paper)", border: "1px solid var(--ink)" }}
        >
          Filtrer
        </button>
      </form>

      {/* Liste */}
      <section className="space-y-2">
        {items.length === 0 ? (
          <div
            className="rounded-lg p-6 text-center text-sm"
            style={{ background: "var(--paper)", border: "1px solid var(--line)", color: "var(--ink-3)" }}
          >
            Aucune consultation pour ces filtres.
          </div>
        ) : (
          items.map((it) => <RevealRow key={it.id} item={it} />)
        )}
      </section>

      {/* Pagination */}
      <nav className="flex justify-between items-center text-xs">
        {page > 0 ? (
          <a href={buildHref({ field, period, page: page - 1 })} className="underline" style={{ color: "var(--ink)" }}>
            ← Précédent
          </a>
        ) : (
          <span />
        )}
        {items.length === 50 && (
          <a href={buildHref({ field, period, page: page + 1 })} className="underline" style={{ color: "var(--ink)" }}>
            Suivant →
          </a>
        )}
      </nav>
    </div>
  );
}

function RevealRow({
  item,
}: {
  item: Awaited<ReturnType<typeof fetchProRevealsList>>[number];
}) {
  const isDetails = item.field === "details";
  const tone = isDetails
    ? { bg: "color-mix(in oklab, var(--accent) 10%, var(--paper))", color: "var(--accent)" }
    : { bg: "color-mix(in oklab, var(--ink-2) 8%, var(--paper))", color: "var(--ink-2)" };

  return (
    <article className="rounded-lg p-4" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
      <header className="flex flex-wrap items-center gap-3 mb-2">
        <span className="text-xs rounded px-2 py-0.5 font-medium" style={{ background: tone.bg, color: tone.color }}>
          {isDetails ? "🔎 Détail complet" : `👁 ${FIELD_LABEL[item.field] ?? item.field}`}
        </span>
        <span className="text-xs" style={{ color: "var(--ink-4)", fontFamily: "var(--mono)" }}>
          {fmtDate(item.revealedAt)}
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
        <div>
          <span
            className="text-[10px] uppercase mr-1"
            style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
          >
            Pro
          </span>
          {item.pro ? (
            <Link href={`/buupp-admin/pros/${item.pro.id}`} className="underline" style={{ color: "var(--ink)" }}>
              {item.pro.raisonSociale}
            </Link>
          ) : (
            <span style={{ color: "var(--ink-4)" }}>—</span>
          )}
        </div>
        <div>
          <span
            className="text-[10px] uppercase mr-1"
            style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
          >
            Prospect
          </span>
          {item.prospect ? (
            <Link
              href={`/buupp-admin/prospects/${item.prospect.id}`}
              className="underline"
              style={{ color: "var(--ink)" }}
            >
              {item.prospect.prenom ?? "—"} {item.prospect.nomInitial ?? ""}
            </Link>
          ) : (
            <span style={{ color: "var(--ink-4)" }}>—</span>
          )}
        </div>
        <div>
          <span
            className="text-[10px] uppercase mr-1"
            style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
          >
            Campagne
          </span>
          <span>{item.campaign?.name ?? "—"}</span>
        </div>
      </div>
    </article>
  );
}

function buildHref(o: {
  field: ProRevealsFilters["field"];
  period: ProRevealsFilters["period"];
  page: number;
}): string {
  const u = new URLSearchParams();
  u.set("field", o.field);
  u.set("period", o.period);
  if (o.page > 0) u.set("page", String(o.page));
  return `/buupp-admin/pro-reveals?${u.toString()}`;
}

function Kpi({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: number | string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "var(--paper)",
        border: alert
          ? "1px solid color-mix(in oklab, var(--danger) 40%, var(--line))"
          : "1px solid var(--line)",
      }}
    >
      <div
        className="text-[11px] uppercase mb-1"
        style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
      >
        {label}
      </div>
      <div
        className="text-2xl"
        style={{
          fontFamily: "var(--serif)",
          color: alert && typeof value === "number" && value > 0 ? "var(--danger)" : "var(--ink)",
        }}
      >
        {typeof value === "number" ? new Intl.NumberFormat("fr-FR").format(value) : value}
      </div>
      {hint && (
        <div
          className="text-[10px] mt-1"
          style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.04em" }}
        >
          {hint}
        </div>
      )}
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
        style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
      >
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="text-sm rounded px-2 py-1.5"
        style={{ background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" }}
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
