import type { SuggestionListItem } from "@/lib/admin/queries/suggestions";
import SuggestionActions from "./SuggestionActions";

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

export default function SuggestionCard({ s }: { s: SuggestionListItem }) {
  const isResolved = s.resolvedAt != null;
  const isRead = s.readAt != null;
  const statusLabel = isResolved ? "Résolu" : isRead ? "Lu" : "Non lu";
  const statusTone = isResolved
    ? { bg: "color-mix(in oklab, var(--good) 12%, var(--paper))", color: "var(--good)" }
    : isRead
      ? { bg: "var(--ivory-2)", color: "var(--ink-2)" }
      : { bg: "color-mix(in oklab, var(--warn) 14%, var(--paper))", color: "var(--warn)" };

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="text-[11px] rounded px-2 py-0.5"
              style={{ background: statusTone.bg, color: statusTone.color }}
            >
              {statusLabel}
            </span>
            <span
              className="text-[11px] rounded px-2 py-0.5"
              style={
                s.emailSentAt
                  ? { background: "var(--ivory-2)", color: "var(--ink-3)" }
                  : {
                      background:
                        "color-mix(in oklab, var(--danger) 12%, var(--paper))",
                      color: "var(--danger)",
                    }
              }
            >
              {s.emailSentAt ? "E-mail envoyé ✓" : "E-mail échec ✗"}
            </span>
            <span className="text-xs" style={{ color: "var(--ink-4)" }}>
              {fmtDate(s.createdAt)}
            </span>
          </div>
          <div className="text-sm" style={{ color: "var(--ink-3)" }}>
            {s.fromName ?? "—"}
            {s.fromEmail ? ` · ${s.fromEmail}` : ""}
            {s.fromRole ? ` · ${s.fromRole}` : ""}
          </div>
          {s.subject && (
            <div
              className="mt-2 text-base"
              style={{ fontFamily: "var(--serif)" }}
            >
              {s.subject}
            </div>
          )}
          <div
            className="mt-1 text-sm"
            style={{ color: "var(--ink-2)", whiteSpace: "pre-wrap" }}
          >
            {s.message}
          </div>
          {s.resolvedNote && (
            <div
              className="mt-2 text-xs rounded p-2"
              style={{
                background: "var(--ivory)",
                border: "1px solid var(--line)",
                color: "var(--ink-3)",
              }}
            >
              Note : {s.resolvedNote}
            </div>
          )}
        </div>
        <SuggestionActions id={s.id} isRead={isRead} isResolved={isResolved} />
      </div>
    </div>
  );
}
