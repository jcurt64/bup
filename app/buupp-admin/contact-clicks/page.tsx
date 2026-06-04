/**
 * /buupp-admin/contact-clicks — Clics du pro sur les icônes de contact
 * (table pro_contact_clicks : téléphone, e-mail, SMS, WhatsApp, Facebook).
 *
 * Liste filtrable (canal, période, pagination) + KPIs, dont la détection
 * des « accès répétés » : un même pro qui clique pour contacter un même
 * prospect ≥ 3 fois en 24 h (seuil aligné sur le mail de rappel au pro,
 * cf. lib/pro/contact-click-alert.ts).
 */
import Link from "next/link";
import {
  fetchContactClicksList,
  fetchContactClicksKpis,
  type ContactClicksFilters,
} from "@/lib/admin/queries/pro-contact-clicks";

export const dynamic = "force-dynamic";

const CHANNEL_OPTIONS: Array<{ value: ContactClicksFilters["channel"]; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "call", label: "Téléphone" },
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "facebook", label: "Facebook" },
];

const PERIOD_OPTIONS: Array<{ value: ContactClicksFilters["period"]; label: string }> = [
  { value: "24h", label: "24 heures" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "all", label: "Tout" },
];

const CHANNEL_LABEL: Record<string, string> = {
  call: "📞 Téléphone",
  email: "✉️ E-mail",
  sms: "💬 SMS",
  whatsapp: "🟢 WhatsApp",
  facebook: "🔵 Facebook",
};

function asChannel(v: string | undefined): ContactClicksFilters["channel"] {
  if (v === "call" || v === "email" || v === "sms" || v === "whatsapp" || v === "facebook")
    return v;
  return "all";
}
function asPeriod(v: string | undefined): ContactClicksFilters["period"] {
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

export default async function ContactClicksAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; period?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const channel = asChannel(sp.channel);
  const period = asPeriod(sp.period);
  const pageRaw = Number(sp.page ?? "0");
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;

  const [items, kpis] = await Promise.all([
    fetchContactClicksList({ channel, period, page }),
    fetchContactClicksKpis({ period }),
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
          Contacts (clics)
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-3)", maxWidth: 720 }}>
          Chaque clic d&apos;un pro sur une icône de contact d&apos;un prospect
          (téléphone, e-mail, SMS, WhatsApp, Facebook) est journalisé ici. La
          carte «&nbsp;Accès répétés&nbsp;» signale les pros qui cliquent pour
          contacter un même prospect au moins {kpis.repeatThreshold} fois en
          24&nbsp;h — cas où le pro reçoit automatiquement un e-mail de rappel du
          cadre d&apos;usage des données.
        </p>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="Clics de contact" value={kpis.totalClicks} hint="sur la période" />
        <Kpi
          label="Accès répétés (24h)"
          value={kpis.repeatedPairs}
          alert={kpis.repeatedPairs > 0}
          hint={`≥ ${kpis.repeatThreshold} clics / même prospect`}
        />
      </section>

      {/* Filtres */}
      <form method="GET" className="flex flex-wrap gap-2 items-end">
        <Select name="channel" value={channel} options={CHANNEL_OPTIONS} label="Canal" />
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
            Aucun clic de contact pour ces filtres.
          </div>
        ) : (
          items.map((it) => <ClickRow key={it.id} item={it} />)
        )}
      </section>

      {/* Pagination */}
      <nav className="flex justify-between items-center text-xs">
        {page > 0 ? (
          <a href={buildHref({ channel, period, page: page - 1 })} className="underline" style={{ color: "var(--ink)" }}>
            ← Précédent
          </a>
        ) : (
          <span />
        )}
        {items.length === 50 && (
          <a href={buildHref({ channel, period, page: page + 1 })} className="underline" style={{ color: "var(--ink)" }}>
            Suivant →
          </a>
        )}
      </nav>
    </div>
  );
}

function ClickRow({
  item,
}: {
  item: Awaited<ReturnType<typeof fetchContactClicksList>>[number];
}) {
  return (
    <article className="rounded-lg p-4" style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
      <header className="flex flex-wrap items-center gap-3 mb-2">
        <span
          className="text-xs rounded px-2 py-0.5 font-medium"
          style={{ background: "color-mix(in oklab, var(--accent) 10%, var(--paper))", color: "var(--accent)" }}
        >
          {CHANNEL_LABEL[item.channel] ?? item.channel}
        </span>
        <span className="text-xs" style={{ color: "var(--ink-4)", fontFamily: "var(--mono)" }}>
          {fmtDate(item.createdAt)}
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
  channel: ContactClicksFilters["channel"];
  period: ContactClicksFilters["period"];
  page: number;
}): string {
  const u = new URLSearchParams();
  u.set("channel", o.channel);
  u.set("period", o.period);
  if (o.page > 0) u.set("page", String(o.page));
  return `/buupp-admin/contact-clicks?${u.toString()}`;
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
