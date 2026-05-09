"use client";

import { useEffect, useState } from "react";

/**
 * Modal de confirmation avant déconnexion. Réutilisable :
 *   - Header de la home (Navbar) sur le bouton "Se déconnecter".
 *   - PrototypeFrame quand le shell iframe envoie `bupp:signOut`.
 *
 * Pourquoi un composant dédié plutôt qu'une simple `confirm()` :
 *   - cohérence visuelle avec le reste du design system (boutons, type,
 *     couleurs) ;
 *   - confirme() bloque le thread JS et est facilement masqué par le
 *     navigateur ("autoriser à nouveau ce site à afficher des dialogues").
 */
export default function LogoutConfirmModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);

  // ESC ferme la modale (sauf pendant la déconnexion en cours).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, busy]);

  // Reset du flag busy quand la modale se referme — évite que la
  // prochaine ouverture hérite d'un état "Déconnexion en cours…".
  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      // Si onConfirm n'a pas démonté ce composant (ex. signOut déclenché
      // depuis la home : `redirectUrl:"/"` est un no-op puisqu'on y est
      // déjà), on referme nous-mêmes la modale. Sinon le loader resterait
      // figé indéfiniment.
      onCancel();
    } catch (err) {
      console.error("[LogoutConfirmModal] confirm failed", err);
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15, 22, 41, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        style={{
          background: "var(--paper, #FBF9F3)",
          color: "var(--ink, #0F1629)",
          borderRadius: 16,
          width: "min(440px, 100%)",
          padding: "26px 24px 20px",
          boxShadow: "0 24px 64px -12px rgba(15,22,41,.45)",
          border: "1px solid var(--line, #E5E1D6)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--accent, #4F46E5)",
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          Confirmation
        </div>
        <h2
          id="logout-confirm-title"
          style={{
            fontSize: 22,
            lineHeight: 1.25,
            margin: 0,
            marginBottom: 10,
            fontWeight: 500,
            fontFamily: "var(--serif, Georgia, serif)",
          }}
        >
          Se déconnecter de <em style={{ color: "var(--accent, #4F46E5)" }}>BUUPP</em> ?
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--ink-3, #475467)",
            margin: 0,
            marginBottom: 22,
          }}
        >
          Vous serez redirigé vers la page d&apos;accueil. Vous pourrez vous
          reconnecter à tout moment depuis le bouton{" "}
          <strong>Connexion</strong> dans la barre de navigation.
        </p>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--line, #E5E1D6)",
              background: "transparent",
              color: "var(--ink, #0F1629)",
              fontSize: 13,
              fontWeight: 500,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.5 : 1,
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: 0,
              background: "var(--ink, #0F1629)",
              color: "var(--paper, #FBF9F3)",
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {busy ? "Déconnexion…" : "Se déconnecter"}
            <span aria-hidden style={{ fontSize: 14 }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
