/**
 * /buupp-admin/contact-actions — Audit des actions pros via BUUPP.
 *
 * Liste les call_clicked et email_sent agrégés depuis la table
 * pro_contact_actions, avec filtres (kind, période, pagination), KPI
 * d'usage (calls, emails envoyés, emails ouverts, pros suspects).
 *
 * Détection légère de patterns suspects : pros qui dépassent 10 actions
 * en 24 h (volume inhabituel pour un usage normal, peut indiquer un
 * scraping ou copier-coller en masse).
 */
import Link from "next/link";
import {
  fetchContactActionsList,
  fetchContactActionsKpis,
  type ContactActionsFilters,
} from "@/lib/admin/queries/contact-actions";

export const dynamic = "force-dynamic";

const KIND_OPTIONS: Array<{ value: ContactActionsFilters["kind"]; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "email_sent", label: "Emails" },
  { value: "call_clicked", label: "Appels" },
];

const PERIOD_OPTIONS: Array<{
  value: ContactActionsFilters["period"];
  label: string;
}> = [
  { value: "24h", label: "24 heures" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "all", label: "Tout" },
];

function asKind(v: string | undefined): ContactActionsFilters["kind"] {
  if (v === "email_sent" || v === "call_clicked") return v;
  return "all";
}
function asPeriod(v: string | undefined): ContactActionsFilters["period"] {
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

export default async function ContactActionsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; period?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const kind = asKind(sp.kind);
  const period = asPeriod(sp.period);
  const pageRaw = Number(sp.page ?? "0");
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;

  const [items, kpis] = await Promise.all([
    fetchContactActionsList({ kind, period, page }),
    fetchContactActionsKpis({ period }),
  ]);

  const openRate =
    kpis.totalEmails === 0
      ? 0
      : Math.round((kpis.emailsOpened / kpis.totalEmails) * 100);

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
          Anti-fraude · Activité pros
        </div>
        <h1 className="text-xl font-medium" style={{ letterSpacing: "-0.01em" }}>
          Actions sur les contacts
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-3)", maxWidth: 720 }}>
          Toutes les actions effectuées par les pros via BUUPP sur les prospects
          acquis : appels téléphoniques (clic sur tel:) et emails envoyés via
          notre transport (avec sujet, corps et statut d&apos;ouverture si le
          prospect a consenti au tracking).
        </p>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Emails envoyés" value={kpis.totalEmails} />
        <Kpi
          label="Taux d'ouverture"
          value={`${openRate}%`}
          hint={`${kpis.emailsOpened}/${kpis.totalEmails} ouverts`}
        />
        <Kpi label="Appels lancés" value={kpis.totalCalls} />
        <Kpi
          label="Pros suspects (24h)"
          value={kpis.suspiciousProsCount}
          alert={kpis.suspiciousProsCount > 0}
          hint=">10 actions sur 24h"
        />
      </section>

      {/* Filtres */}
      <form
        method="GET"
        className="flex flex-wrap gap-2 items-end"
      >
        <Select name="kind" value={kind} options={KIND_OPTIONS} label="Type" />
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
      <section className="space-y-2">
        {items.length === 0 ? (
          <div
            className="rounded-lg p-6 text-center text-sm"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              color: "var(--ink-3)",
            }}
          >
            Aucune action pour ces filtres.
          </div>
        ) : (
          items.map((a) => <ActionRow key={a.id} action={a} />)
        )}
      </section>

      {/* Pagination */}
      <nav className="flex justify-between items-center text-xs">
        {page > 0 ? (
          <a
            href={buildHref({ kind, period, page: page - 1 })}
            className="underline"
            style={{ color: "var(--ink)" }}
          >
            ← Précédent
          </a>
        ) : (
          <span />
        )}
        {items.length === 50 && (
          <a
            href={buildHref({ kind, period, page: page + 1 })}
            className="underline"
            style={{ color: "var(--ink)" }}
          >
            Suivant →
          </a>
        )}
      </nav>
    </div>
  );
}

function ActionRow({
  action,
}: {
  action: Awaited<ReturnType<typeof fetchContactActionsList>>[number];
}) {
  const isEmail = action.kind === "email_sent";
  const tone = isEmail
    ? { bg: "color-mix(in oklab, var(--accent) 8%, var(--paper))", color: "var(--accent)" }
    : { bg: "color-mix(in oklab, var(--ink-2) 8%, var(--paper))", color: "var(--ink-2)" };

  return (
    <article
      className="rounded-lg p-4"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
      }}
    >
      <header className="flex flex-wrap items-start gap-3 mb-2">
        <span
          className="text-xs rounded px-2 py-0.5 font-medium"
          style={{ background: tone.bg, color: tone.color }}
        >
          {isEmail ? "📧 Email envoyé" : "📞 Appel lancé"}
        </span>
        <span
          className="text-xs"
          style={{ color: "var(--ink-4)", fontFamily: "var(--mono)" }}
        >
          {fmtDate(action.createdAt)}
        </span>
        {isEmail && (
          <span
            className="text-[11px] rounded px-2 py-0.5 ml-auto"
            style={{
              background: action.emailOpenedAt
                ? "color-mix(in oklab, var(--good) 14%, var(--paper))"
                : "var(--ivory-2)",
              color: action.emailOpenedAt ? "var(--good)" : "var(--ink-4)",
              fontFamily: "var(--mono)",
              letterSpacing: "0.06em",
            }}
            title={
              action.emailOpenedAt
                ? `Ouvert le ${fmtDate(action.emailOpenedAt)}`
                : "Pas encore ouvert (ou consentement tracking refusé)"
            }
          >
            {action.emailOpenedAt ? "Ouvert" : "Non ouvert"}
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm mb-2">
        <div>
          <span className="text-[10px] uppercase mr-1"
            style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}>
            Pro
          </span>
          {action.pro ? (
            <Link
              href={`/buupp-admin/pros/${action.pro.id}`}
              className="underline"
              style={{ color: "var(--ink)" }}
            >
              {action.pro.raisonSociale}
            </Link>
          ) : (
            <span style={{ color: "var(--ink-4)" }}>—</span>
          )}
        </div>
        <div>
          <span className="text-[10px] uppercase mr-1"
            style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}>
            Prospect
          </span>
          {action.prospect ? (
            <Link
              href={`/buupp-admin/prospects/${action.prospect.id}`}
              className="underline"
              style={{ color: "var(--ink)" }}
            >
              {action.prospect.prenom ?? "—"} {action.prospect.nomInitial ?? ""}
            </Link>
          ) : (
            <span style={{ color: "var(--ink-4)" }}>—</span>
          )}
        </div>
        <div>
          <span className="text-[10px] uppercase mr-1"
            style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}>
            Campagne
          </span>
          <span>{action.campaign?.name ?? "—"}</span>
        </div>
      </div>

      {isEmail && action.emailSubject && (
        <div className="text-sm mt-2" style={{ color: "var(--ink-2)" }}>
          <strong>Objet :</strong> {action.emailSubject}
        </div>
      )}
      {isEmail && action.emailBody && (
        <details className="text-sm mt-2" style={{ color: "var(--ink-3)" }}>
          <summary
            className="cursor-pointer text-xs"
            style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
          >
            Voir le corps du message
          </summary>
          <div
            className="mt-2 rounded p-3 text-sm whitespace-pre-wrap"
            style={{
              background: "var(--ivory)",
              border: "1px solid var(--line)",
              fontStyle: "italic",
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {action.emailBody}
          </div>
        </details>
      )}
    </article>
  );
}

function buildHref(o: {
  kind: ContactActionsFilters["kind"];
  period: ContactActionsFilters["period"];
  page: number;
}): string {
  const u = new URLSearchParams();
  u.set("kind", o.kind);
  u.set("period", o.period);
  if (o.page > 0) u.set("page", String(o.page));
  return `/buupp-admin/contact-actions?${u.toString()}`;
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
        style={{
          color: "var(--ink-4)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.06em",
        }}
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
        {typeof value === "number"
          ? new Intl.NumberFormat("fr-FR").format(value)
          : value}
      </div>
      {hint && (
        <div
          className="text-[10px] mt-1"
          style={{
            color: "var(--ink-4)",
            fontFamily: "var(--mono)",
            letterSpacing: "0.04em",
          }}
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
