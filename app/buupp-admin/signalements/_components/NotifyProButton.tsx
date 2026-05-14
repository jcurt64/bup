"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Bouton "Avertir ce pro" — workflow en 2 temps :
 *
 *  1. Clic sur le bouton → fetch GET /preview, ouvre une modale avec
 *     aperçu HTML iframé (rendu identique au mail réel) + From / À /
 *     Objet en en-tête.
 *  2. Dans la modale, clic 'Envoyer' → POST /notify-pro déclenche
 *     l'envoi serveur, persiste notified_at, ferme la modale et rafraîchit
 *     la liste pour passer en chip "Pro averti".
 *
 * Si notifiedAt est déjà set côté serveur, le composant affiche directement
 * la chip verte (pas de modale ouvrable).
 */
export default function NotifyProButton({
  reportId,
  notifiedAt,
}: {
  reportId: string;
  notifiedAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<{
    from: string;
    to: string;
    subject: string;
    html: string;
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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

  // Fermeture sur Escape — UX standard pour les modales.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  // État final : déjà envoyé → chip verte, pas de modale possible.
  // (Doit être placé APRÈS tous les hooks pour ne pas casser l'ordre.)
  if (notifiedAt) {
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

  const closeModal = () => {
    if (pending) return;
    setOpen(false);
    setSendError(null);
    // Garder preview/previewError en cache pour la prochaine ouverture
    // évite un re-fetch inutile si l'admin ré-ouvre.
  };

  const openModal = async () => {
    setOpen(true);
    setSendError(null);
    if (preview || previewLoading) return; // cache hit
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const r = await fetch(`/api/admin/reports/${reportId}/notify-pro/preview`);
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        const codeMap: Record<string, string> = {
          pro_not_linked: "Ce pro n'a pas de compte Clerk lié.",
          pro_email_missing: "Aucun email trouvé pour ce pro.",
          pro_email_lookup_failed: "Impossible de récupérer l'email côté Clerk.",
        };
        const code = String(j?.error ?? "");
        setPreviewError(codeMap[code] ?? "Échec du chargement de l'aperçu.");
        return;
      }
      const j = await r.json();
      setPreview({ from: j.from, to: j.to, subject: j.subject, html: j.html });
    } catch {
      setPreviewError("Échec réseau — réessayez.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const send = () => {
    setSendError(null);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/admin/reports/${reportId}/notify-pro`, {
          method: "POST",
        });
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          const codeMap: Record<string, string> = {
            pro_not_linked: "Ce pro n'a pas de compte Clerk lié.",
            pro_email_missing: "Aucun email trouvé pour ce pro.",
            pro_email_lookup_failed: "Impossible de récupérer l'email côté Clerk.",
            email_send_failed: "Échec d'envoi SMTP — réessayez.",
            already_notified: "Le pro a déjà été averti pour ce signalement.",
          };
          const code = String(j?.error ?? "");
          setSendError(codeMap[code] ?? "Échec — réessayez.");
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setSendError("Échec réseau — réessayez.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-xs rounded px-3 py-1.5 inline-flex items-center transition-colors cursor-pointer"
        style={{
          background: "var(--paper)",
          color: "var(--ink-2)",
          border: "1px solid var(--line)",
        }}
        title="Voir et envoyer le mail d'avertissement au pro"
      >
        Avertir ce pro
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
          style={{ background: "rgba(15,22,41,0.55)", padding: "32px 16px" }}
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl rounded-lg overflow-hidden flex flex-col"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              boxShadow: "0 18px 48px -16px rgba(15,22,41,.35)",
              maxHeight: "calc(100vh - 64px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête modale */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 18,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                Aperçu du mail à envoyer
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={pending}
                aria-label="Fermer"
                className="cursor-pointer"
                style={{
                  background: "transparent",
                  color: "var(--ink-4)",
                  fontSize: 22,
                  lineHeight: 1,
                  padding: 4,
                  border: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Bloc en-tête du mail (from / to / subject) */}
            {preview && (
              <div
                className="px-5 py-3 text-xs"
                style={{
                  background: "var(--ivory)",
                  borderBottom: "1px solid var(--line)",
                  color: "var(--ink-3)",
                  fontFamily: "var(--mono)",
                  lineHeight: 1.7,
                }}
              >
                <div>
                  <span style={{ color: "var(--ink-5)" }}>De :</span> {preview.from}
                </div>
                <div>
                  <span style={{ color: "var(--ink-5)" }}>À :</span> {preview.to}
                </div>
                <div>
                  <span style={{ color: "var(--ink-5)" }}>Objet :</span>{" "}
                  {preview.subject}
                </div>
              </div>
            )}

            {/* Corps : iframe avec le HTML exact du mail */}
            <div
              className="flex-1 overflow-hidden"
              style={{ background: "#F7F4EC", minHeight: 400 }}
            >
              {previewLoading && (
                <div
                  className="flex items-center justify-center h-full text-sm"
                  style={{ color: "var(--ink-4)", minHeight: 360 }}
                >
                  Chargement de l&apos;aperçu…
                </div>
              )}
              {previewError && !previewLoading && (
                <div
                  className="flex items-center justify-center h-full text-sm px-6 text-center"
                  style={{ color: "var(--danger)", minHeight: 360 }}
                >
                  {previewError}
                </div>
              )}
              {preview && !previewLoading && !previewError && (
                <iframe
                  title="Aperçu du mail"
                  srcDoc={preview.html}
                  sandbox=""
                  style={{
                    width: "100%",
                    height: 480,
                    border: 0,
                    display: "block",
                  }}
                />
              )}
            </div>

            {/* Footer actions */}
            <div
              className="flex items-center justify-end gap-2 px-5 py-3 flex-wrap"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              {sendError && (
                <span
                  className="text-xs mr-auto"
                  style={{ color: "var(--danger)" }}
                >
                  {sendError}
                </span>
              )}
              <button
                type="button"
                onClick={closeModal}
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
                onClick={send}
                disabled={pending || !preview || !!previewError}
                className="text-xs rounded px-3 py-1.5 cursor-pointer disabled:opacity-60"
                style={{
                  background: "var(--ink)",
                  color: "var(--paper)",
                  border: "1px solid var(--ink)",
                }}
              >
                {pending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
