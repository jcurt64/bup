"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function SuggestionActions({
  id,
  isRead,
  isResolved,
}: {
  id: string;
  isRead: boolean;
  isResolved: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const call = (action: "mark-read" | "resolve" | "reopen", noteVal?: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await fetch("/api/admin/suggestions", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, action, note: noteVal?.trim() || undefined }),
        });
        if (!r.ok) {
          setError("Échec de la mise à jour.");
          return;
        }
        setOpen(false);
        setNote("");
        router.refresh();
      } catch {
        setError("Échec de la mise à jour.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex gap-2">
        {!isRead && !isResolved && (
          <button
            type="button"
            onClick={() => call("mark-read")}
            disabled={pending}
            className="text-xs rounded px-3 py-1.5 transition-colors disabled:opacity-60 cursor-pointer"
            style={{
              background: "var(--ivory-2)",
              color: "var(--ink-2)",
              border: "1px solid var(--line)",
            }}
          >
            {pending ? "…" : "Marquer lu"}
          </button>
        )}
        {!isResolved ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={pending}
            className="text-xs rounded px-3 py-1.5 transition-colors cursor-pointer"
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              border: "1px solid var(--ink)",
            }}
          >
            Résoudre
          </button>
        ) : (
          <button
            type="button"
            onClick={() => call("reopen")}
            disabled={pending}
            className="text-xs rounded px-3 py-1.5 transition-colors disabled:opacity-60 cursor-pointer"
            style={{
              background: "var(--ivory-2)",
              color: "var(--ink-2)",
              border: "1px solid var(--line)",
            }}
          >
            {pending ? "…" : "Rouvrir"}
          </button>
        )}
      </div>
      {open && !isResolved && (
        <div
          className="mt-1 p-3 rounded w-full"
          style={{ background: "var(--ivory)", border: "1px solid var(--line)" }}
        >
          <label
            className="block text-[11px] mb-1.5"
            style={{
              color: "var(--ink-4)",
              fontFamily: "var(--mono)",
              letterSpacing: "0.06em",
            }}
          >
            NOTE INTERNE (facultatif)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 1000))}
            rows={2}
            className="w-full text-sm rounded p-2"
            style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
            placeholder="Décision, suite donnée…"
          />
          {error && (
            <div className="text-xs mt-2" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setNote("");
                setError(null);
              }}
              disabled={pending}
              className="text-xs rounded px-3 py-1.5 cursor-pointer"
              style={{
                background: "var(--paper)",
                color: "var(--ink-3)",
                border: "1px solid var(--line)",
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => call("resolve", note)}
              disabled={pending}
              className="text-xs rounded px-3 py-1.5 cursor-pointer disabled:opacity-60"
              style={{
                background: "var(--ink)",
                color: "var(--paper)",
                border: "1px solid var(--ink)",
              }}
            >
              {pending ? "Envoi…" : "Confirmer"}
            </button>
          </div>
        </div>
      )}
      {error && !open && (
        <div className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
