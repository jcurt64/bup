"use client";

import { useEffect, useState } from "react";

type Role = "prospect" | "pro";

const COPY: Record<Role, string> = {
  prospect:
    "Cette adresse email est déjà associée à un compte prospect. Connectez-vous avec ce compte ou utilisez une autre adresse pour créer un compte pro.",
  pro:
    "Cette adresse email est déjà associée à un compte professionnel. Connectez-vous avec ce compte ou utilisez une autre adresse pour créer un compte prospect.",
};

export default function RoleConflictToast({ existingRole }: { existingRole: Role }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setOpen(false), 8000);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        background: "#0F1629",
        color: "#FBF9F3",
        padding: "14px 18px",
        borderRadius: 12,
        boxShadow: "0 18px 48px -12px rgba(0,0,0,.35)",
        maxWidth: 520,
        fontSize: 14,
        lineHeight: 1.45,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <span style={{ flex: 1 }}>{COPY[existingRole]}</span>
      <button
        onClick={() => setOpen(false)}
        aria-label="Fermer"
        style={{
          background: "transparent",
          border: 0,
          color: "rgba(255,255,255,.7)",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
