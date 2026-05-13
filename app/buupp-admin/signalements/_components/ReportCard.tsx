import Link from "next/link";
import type { ReportListItem } from "@/lib/admin/queries/reports";
import ResolveButton from "./ResolveButton";

const REASON_LABEL: Record<ReportListItem["reason"], string> = {
  sollicitation_multiple: "Sollicitation multiple",
  faux_compte: "Faux compte",
  echange_abusif: "Échange abusif",
};

const REASON_TONE: Record<
  ReportListItem["reason"],
  { bg: string; color: string }
> = {
  sollicitation_multiple: {
    bg: "color-mix(in oklab, var(--warn) 14%, var(--paper))",
    color: "var(--warn)",
  },
  echange_abusif: {
    bg: "color-mix(in oklab, var(--danger) 12%, var(--paper))",
    color: "var(--danger)",
  },
  faux_compte: {
    bg: "var(--ivory-2)",
    color: "var(--ink-2)",
  },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function ReportCard({ report }: { report: ReportListItem }) {
  const tone = REASON_TONE[report.reason];
  const isResolved = report.resolvedAt !== null;
  return (
    <article
      className="rounded-lg p-4"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      <header className="flex flex-wrap items-start gap-3 mb-3">
        <span
          className="text-xs rounded px-2 py-0.5 font-medium"
          style={{ background: tone.bg, color: tone.color }}
        >
          {REASON_LABEL[report.reason]}
        </span>
        <span
          className="text-xs"
          style={{ color: "var(--ink-4)", fontFamily: "var(--mono)" }}
        >
          {fmtDate(report.createdAt)}
        </span>
        <div className="ml-auto">
          {isResolved ? (
            <span
              className="text-[11px] uppercase rounded px-2 py-0.5"
              style={{
                background: "color-mix(in oklab, var(--good) 14%, var(--paper))",
                color: "var(--good)",
                fontFamily: "var(--mono)",
                letterSpacing: "0.06em",
              }}
            >
              Traité
            </span>
          ) : (
            <span
              className="text-[11px] uppercase rounded px-2 py-0.5"
              style={{
                background: "color-mix(in oklab, var(--warn) 14%, var(--paper))",
                color: "var(--warn)",
                fontFamily: "var(--mono)",
                letterSpacing: "0.06em",
              }}
            >
              À traiter
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
        <div>
          <div
            className="text-[11px] uppercase mb-1"
            style={{
              color: "var(--ink-4)",
              fontFamily: "var(--mono)",
              letterSpacing: "0.06em",
            }}
          >
            Pro signalé
          </div>
          {report.pro ? (
            <Link
              href={`/buupp-admin/pros/${report.pro.id}`}
              className="underline"
              style={{ color: "var(--ink)" }}
            >
              {report.pro.raisonSociale}
            </Link>
          ) : (
            <span style={{ color: "var(--ink-4)" }}>—</span>
          )}
        </div>
        <div>
          <div
            className="text-[11px] uppercase mb-1"
            style={{
              color: "var(--ink-4)",
              fontFamily: "var(--mono)",
              letterSpacing: "0.06em",
            }}
          >
            Prospect signaleur
          </div>
          {report.prospect ? (
            <Link
              href={`/buupp-admin/prospects/${report.prospect.id}`}
              className="underline"
              style={{ color: "var(--ink)" }}
            >
              {report.prospect.prenom ?? "—"}{" "}
              {report.prospect.nomInitial ?? ""}
            </Link>
          ) : (
            <span style={{ color: "var(--ink-4)" }}>—</span>
          )}
        </div>
      </div>

      {report.campaign && report.relation && (
        <div className="text-xs mb-3" style={{ color: "var(--ink-3)" }}>
          Campagne <strong>{report.campaign.name}</strong> · sollicitée le{" "}
          {fmtDate(report.relation.sentAt)}
          {report.relation.motif && (
            <>
              <br />
              <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>
                « {report.relation.motif.slice(0, 200)}
                {report.relation.motif.length > 200 ? "…" : ""} »
              </span>
            </>
          )}
        </div>
      )}

      {report.comment && (
        <div
          className="rounded p-3 text-sm mb-3"
          style={{
            background: "var(--ivory)",
            border: "1px solid var(--line)",
            fontStyle: "italic",
            color: "var(--ink-2)",
          }}
        >
          « {report.comment} »
        </div>
      )}

      {isResolved && (
        <div className="text-xs mb-3" style={{ color: "var(--ink-4)" }}>
          Traité le {fmtDate(report.resolvedAt)}
          {report.resolvedByClerkId ? ` par ${report.resolvedByClerkId}` : ""}.
          {report.resolvedNote && (
            <>
              <br />
              <span style={{ fontStyle: "italic" }}>
                Note : {report.resolvedNote}
              </span>
            </>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <ResolveButton
          reportId={report.id}
          action={isResolved ? "reopen" : "resolve"}
        />
      </div>
    </article>
  );
}
