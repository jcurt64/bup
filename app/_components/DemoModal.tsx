"use client";

import { useEffect } from "react";

const CAL_URL = "https://cal.com/m-link64-rejm3c/30min";

export default function DemoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,22,41,.6)",
        backdropFilter: "blur(4px)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 960,
          height: "min(90vh, 820px)",
          background: "var(--paper)",
          borderRadius: 16,
          boxShadow:
            "0 30px 80px -20px rgba(15,22,41,.45), 0 0 0 1px var(--line)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="row between"
          style={{
            alignItems: "center",
            padding: "14px 18px",
            borderBottom: "1px solid var(--line)",
            gap: 10,
          }}
        >
          <h3
            id="demo-modal-title"
            className="serif"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            Réservez votre démo
          </h3>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-4)",
              padding: 4,
              fontSize: 22,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <iframe
          src={CAL_URL}
          title="Calendrier de réservation Cal.com"
          loading="lazy"
          style={{
            flex: 1,
            width: "100%",
            border: 0,
            background: "var(--paper)",
          }}
        />
      </div>
    </div>
  );
}
