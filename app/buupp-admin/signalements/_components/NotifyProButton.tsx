"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Bouton "Avertir ce pro" — déclenche l'envoi serveur du mail HTML BUUPP
 * (template lib/email/pro-report-warning) via POST /api/admin/reports/[id]/notify-pro.
 *
 * 3 états visuels :
 *   - vierge (notifiedAt=null) : bouton plein "Avertir ce pro"
 *   - en cours (pending)       : bouton désactivé "Envoi…"
 *   - envoyé (notifiedAt set)  : chip neutre avec la date d'envoi
 *
 * Après succès : router.refresh() pour resynchroniser le rendu serveur
 * (la chip d'état remplace le bouton sans rechargement complet).
 */
export default function NotifyProButton({
  reportId,
  notifiedAt,
}: {
  reportId: string;
  notifiedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (notifiedAt) {
    const fmt = (iso: string) => {
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
    };
    return (
      <span
        className="text-xs rounded px-3 py-1.5 inline-flex items-center"
        style={{
          background: "color-mix(in oklab, var(--good) 12%, var(--paper))",
          color: "var(--good)",
          border: "1px solid color-mix(in oklab, var(--good) 30%, var(--line))",
        }}
        title={`Mail envoyé au pro le ${fmt(notifiedAt)}`}
      >
        Pro averti · {fmt(notifiedAt)}
      </span>
    );
  }

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/admin/reports/${reportId}/notify-pro`, {
          method: "POST",
        });
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          // Mapping des erreurs API → message lisible.
          const codeMap: Record<string, string> = {
            pro_not_linked: "Ce pro n'a pas de compte Clerk lié.",
            pro_email_missing: "Aucun email trouvé pour ce pro.",
            pro_email_lookup_failed: "Impossible de récupérer l'email côté Clerk.",
            email_send_failed: "Échec d'envoi SMTP — réessayez.",
            already_notified: "Le pro a déjà été averti pour ce signalement.",
          };
          const code = String(j?.error ?? "");
          setError(codeMap[code] ?? "Échec — réessayez.");
          return;
        }
        router.refresh();
      } catch {
        setError("Échec réseau — réessayez.");
      }
    });
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="text-xs rounded px-3 py-1.5 inline-flex items-center transition-colors disabled:opacity-60 cursor-pointer"
        style={{
          background: "var(--paper)",
          color: "var(--ink-2)",
          border: "1px solid var(--line)",
        }}
        title="Envoie un email d'avertissement au pro avec le design BUUPP"
      >
        {pending ? "Envoi…" : "Avertir ce pro"}
      </button>
      {error && (
        <span
          className="text-[11px]"
          style={{ color: "var(--danger)", maxWidth: 220, textAlign: "right" }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
