"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Audience = "prospects" | "pros" | "all";

const AUDIENCE_OPTIONS: { value: Audience; label: string; hint: string }[] = [
  { value: "prospects", label: "Tous les prospects", hint: "Envoie à tous les particuliers inscrits." },
  { value: "pros", label: "Tous les pros", hint: "Envoie à tous les comptes professionnels." },
  { value: "all", label: "Tous les utilisateurs", hint: "Prospects + pros — usage parcimonieux." },
];

const MAX_TITLE = 200;
const MAX_BODY = 10_000;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.txt,.md";

export default function BroadcastComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("prospects");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Pilote la modale de confirmation custom (remplace `window.confirm`,
  // qui ne respecte pas le design du back-office et passe mal sur mobile).
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle("");
    setBody("");
    setAudience("prospects");
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function pickFile(file: File | null) {
    setError(null);
    if (!file) {
      setAttachment(null);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`Pièce jointe trop volumineuse (max ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} Mo).`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setAttachment(file);
  }

  function onSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccess(null);

    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      setError("Titre et contenu requis.");
      return;
    }

    // Bascule sur la modale custom — l'envoi effectif se fait dans
    // `doSend()` après confirmation utilisateur.
    setConfirmOpen(true);
  }

  async function doSend() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("body", body.trim());
      form.set("audience", audience);
      if (attachment) form.set("attachment", attachment);

      const res = await fetch("/api/admin/broadcasts", { method: "POST", body: form });
      const json: {
        id?: string;
        recipientCount?: number;
        error?: string;
        debug?: { code?: string; message?: string };
      } = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) {
        const base = errorLabel(json.error) ?? "Échec de l'envoi.";
        // Le bloc `debug` n'est renvoyé qu'en dev (côté API). Permet à
        // l'admin de comprendre immédiatement si la table manque, si RLS
        // bloque, etc. — sans avoir à aller dans les logs.
        const detail = json.debug?.message ? ` — ${json.debug.message}` : "";
        setError(base + detail);
        setConfirmOpen(false);
        return;
      }
      setSuccess(
        `Message créé — ${json.recipientCount ?? 0} destinataire${(json.recipientCount ?? 0) > 1 ? "s" : ""}. Les emails partent en arrière-plan.`,
      );
      reset();
      setConfirmOpen(false);
      // Rafraîchit la table d'historique en bas de la page.
      router.refresh();
    } catch (err) {
      console.error("[BroadcastComposer] submit failed", err);
      setError("Une erreur réseau est survenue.");
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  const titleLen = title.length;
  const bodyLen = body.length;

  return (
    <>
    <form className="space-y-4" onSubmit={onSubmit}>
      <Field label="Titre" hint={`${titleLen} / ${MAX_TITLE}`}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
          placeholder="Ex. Mise à jour des conditions générales"
          required
          disabled={submitting}
          className="w-full rounded-md text-sm px-3 py-2"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
          }}
        />
      </Field>

      <Field label="Contenu" hint={`${bodyLen} / ${MAX_BODY}`}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
          placeholder="Écrivez votre message ici. Les retours à la ligne sont préservés."
          required
          rows={8}
          disabled={submitting}
          className="w-full rounded-md text-sm px-3 py-2 leading-relaxed"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            resize: "vertical",
            fontFamily: "var(--sans)",
          }}
        />
      </Field>

      <Field label="Audience">
        <div className="grid sm:grid-cols-3 gap-2">
          {AUDIENCE_OPTIONS.map((opt) => {
            const active = audience === opt.value;
            return (
              <label
                key={opt.value}
                className="rounded-md p-3 cursor-pointer transition-colors"
                style={{
                  background: active ? "var(--ink)" : "var(--ivory-2)",
                  color: active ? "var(--paper)" : "var(--ink-2)",
                  border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                }}
              >
                <input
                  type="radio"
                  name="audience"
                  value={opt.value}
                  checked={active}
                  onChange={() => setAudience(opt.value)}
                  disabled={submitting}
                  className="sr-only"
                />
                <div className="text-sm font-semibold">{opt.label}</div>
                <div
                  className="text-[11px] mt-1"
                  style={{ color: active ? "rgba(255,254,248,0.7)" : "var(--ink-4)" }}
                >
                  {opt.hint}
                </div>
              </label>
            );
          })}
        </div>
      </Field>

      <Field
        label="Pièce jointe (optionnel)"
        hint={attachment ? formatBytes(attachment.size) : "PDF, image, docx, xlsx, txt — max 5 Mo"}
      >
        {/* L'input file natif est masqué : son `click()` est déclenché par
            le bouton ci-dessous pour offrir un visuel cohérent avec le reste
            du composer (un input file brut demande un double-clic et casse
            le rythme visuel des champs). */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          disabled={submitting}
          className="sr-only"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="rounded-md text-sm inline-flex items-center gap-2 h-9 px-3 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "var(--paper)",
              color: "var(--ink-2)",
              border: "1px solid var(--line)",
            }}
            onMouseEnter={(e) => {
              if (!submitting) e.currentTarget.style.background = "var(--ivory-2)";
            }}
            onMouseLeave={(e) => {
              if (!submitting) e.currentTarget.style.background = "var(--paper)";
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 1 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48" />
            </svg>
            {attachment ? "Changer la pièce jointe" : "Joindre un fichier"}
          </button>
          {attachment && (
            <>
              <span
                className="inline-flex items-center gap-1.5 text-xs rounded-md px-2.5 py-1.5 max-w-full"
                style={{
                  background: "var(--ivory-2)",
                  color: "var(--ink-2)",
                  border: "1px solid var(--line)",
                  fontFamily: "var(--mono)",
                }}
                title={attachment.name}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M7 3h8l4 4v14H7V3z" />
                  <path d="M14 3v5h5" />
                </svg>
                <span className="truncate max-w-55">{attachment.name}</span>
              </span>
              <button
                type="button"
                onClick={() => pickFile(null)}
                disabled={submitting}
                aria-label="Retirer la pièce jointe"
                className="rounded-md inline-flex items-center justify-center w-8 h-8 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "transparent",
                  color: "var(--ink-4)",
                  border: "1px solid var(--line)",
                }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = "var(--danger)";
                    e.currentTarget.style.color = "var(--paper)";
                    e.currentTarget.style.borderColor = "var(--danger)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--ink-4)";
                    e.currentTarget.style.borderColor = "var(--line)";
                  }
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </Field>

      {error && (
        <div
          className="rounded-md text-sm px-3 py-2"
          style={{
            background: "color-mix(in oklab, var(--danger) 12%, transparent)",
            color: "var(--danger)",
            border: "1px solid color-mix(in oklab, var(--danger) 35%, transparent)",
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="rounded-md text-sm px-3 py-2"
          style={{
            background: "color-mix(in oklab, var(--accent) 10%, transparent)",
            color: "var(--accent-ink)",
            border: "1px solid color-mix(in oklab, var(--accent) 30%, transparent)",
          }}
        >
          {success}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 h-10 px-4 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            border: "1px solid var(--ink)",
          }}
        >
          {submitting ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="animate-spin"
                aria-hidden
              >
                <path d="M21 12a9 9 0 1 1-6.2-8.55" />
              </svg>
              Envoi…
            </>
          ) : (
            "Envoyer le message"
          )}
        </button>
      </div>
    </form>

    {confirmOpen && (
      <ConfirmSendModal
        audience={audience}
        title={title.trim()}
        hasAttachment={!!attachment}
        attachmentName={attachment?.name ?? null}
        submitting={submitting}
        onCancel={() => { if (!submitting) setConfirmOpen(false); }}
        onConfirm={doSend}
      />
    )}
  </>
  );
}

// Modale de confirmation avant envoi. Pattern aligné sur la modale de
// déconnexion d'AdminShell (paper bg, ombre douce, actions empilées sur
// mobile via `flex-col-reverse sm:flex-row`). Bouton confirm en accent
// car l'action est consequentielle mais pas destructive.
function ConfirmSendModal({
  audience,
  title,
  hasAttachment,
  attachmentName,
  submitting,
  onCancel,
  onConfirm,
}: {
  audience: Audience;
  title: string;
  hasAttachment: boolean;
  attachmentName: string | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // ESC ferme la modale tant qu'on n'est pas en plein envoi (sinon on
  // pourrait annuler l'action côté UI pendant que la requête tourne).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);

  const audienceLabel =
    audience === "all"
      ? "tous les utilisateurs (prospects + pros)"
      : audience === "prospects"
        ? "tous les prospects"
        : "tous les pros";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.55)" }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="broadcast-confirm-title"
    >
      <div
        className="w-full max-w-md rounded-lg p-6"
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          boxShadow: "0 18px 48px -16px rgba(15,22,41,.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="broadcast-confirm-title"
          style={{
            fontFamily: "var(--serif)",
            fontSize: "20px",
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          Envoyer ce message&nbsp;?
        </div>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--ink-3)", lineHeight: 1.5 }}
        >
          Le message <strong style={{ color: "var(--ink)" }}>« {title} »</strong> sera
          envoyé par email à <strong style={{ color: "var(--ink)" }}>{audienceLabel}</strong>{" "}
          et apparaîtra dans la cloche de leur espace.
        </p>

        <div
          className="mt-4 rounded-md px-3 py-2.5 text-xs space-y-1"
          style={{
            background: "var(--ivory-2)",
            border: "1px solid var(--line)",
            color: "var(--ink-2)",
            fontFamily: "var(--mono)",
            letterSpacing: "0.01em",
          }}
        >
          <div className="flex items-start gap-2">
            <span style={{ color: "var(--ink-4)", minWidth: 80 }}>Audience</span>
            <span>{audienceLabel}</span>
          </div>
          <div className="flex items-start gap-2">
            <span style={{ color: "var(--ink-4)", minWidth: 80 }}>Pièce jointe</span>
            <span className="truncate" title={attachmentName ?? ""}>
              {hasAttachment ? attachmentName ?? "fichier joint" : "—"}
            </span>
          </div>
        </div>

        <p
          className="mt-3 text-xs"
          style={{ color: "var(--ink-4)", lineHeight: 1.5 }}
        >
          L'envoi est irréversible — une fois lancé, les destinataires recevront le
          mail dans les minutes qui suivent.
        </p>

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md text-sm font-medium h-10 px-4 inline-flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "var(--paper)",
              color: "var(--ink-2)",
              border: "1px solid var(--line)",
            }}
            onMouseEnter={(e) => {
              if (!submitting) e.currentTarget.style.background = "var(--ivory-2)";
            }}
            onMouseLeave={(e) => {
              if (!submitting) e.currentTarget.style.background = "var(--paper)";
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-md text-sm font-medium h-10 px-4 inline-flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "var(--accent)",
              color: "var(--paper)",
              border: "1px solid var(--accent)",
            }}
          >
            {submitting ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="animate-spin"
                  aria-hidden
                >
                  <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                </svg>
                Envoi en cours…
              </>
            ) : (
              "Confirmer l'envoi"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between">
        <label
          className="text-[11px] font-bold uppercase"
          style={{ color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
        >
          {label}
        </label>
        {hint && (
          <span className="text-[11px]" style={{ color: "var(--ink-4)", fontFamily: "var(--mono)" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(2)} Mo`;
}

function errorLabel(code: string | undefined): string | null {
  switch (code) {
    case "invalid_title":
      return "Titre invalide (vide ou trop long).";
    case "invalid_body":
      return "Contenu invalide (vide ou trop long).";
    case "invalid_audience":
      return "Audience invalide.";
    case "attachment_too_large":
      return "Pièce jointe trop volumineuse (max 5 Mo).";
    case "attachment_mimetype":
      return "Format de pièce jointe non autorisé.";
    case "invalid_form":
      return "Formulaire invalide.";
    case "insert_failed":
    case "read_failed":
      return "Erreur serveur. Réessayez.";
    default:
      return null;
  }
}
