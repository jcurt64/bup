"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ResolveButton({
  reportId,
  action,
}: {
  reportId: string;
  action: "resolve" | "reopen";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/admin/reports/${reportId}/resolve`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, note: note.trim() || undefined }),
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

  if (action === "reopen") {
    return (
      <button
        type="button"
        onClick={submit}
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
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs rounded px-3 py-1.5 transition-colors cursor-pointer"
        style={{
          background: "var(--ink)",
          color: "var(--paper)",
          border: "1px solid var(--ink)",
        }}
      >
        Marquer traité
      </button>
    );
  }

  return (
    <div
      className="mt-2 p-3 rounded"
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
        placeholder="Ce que tu as constaté, ce qui a été fait…"
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
          onClick={submit}
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
  );
}
