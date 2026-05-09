"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "prospect" | "pro";

const COPY: Record<Role, string> = {
  prospect:
    "Votre compte est associé à un profil prospect. L'espace professionnel n'est pas accessible depuis ce compte — déconnectez-vous puis reconnectez-vous avec un compte pro.",
  pro:
    "Votre compte est associé à un profil professionnel. L'espace prospect n'est pas accessible depuis ce compte — déconnectez-vous puis reconnectez-vous avec un compte prospect.",
};

export default function RoleConflictToast({ existingRole }: { existingRole: Role }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // One-shot : on retire le query param pour qu'un reload de / ne
    // réaffiche pas le toast. `replace` (pas `push`) pour ne pas
    // polluer l'historique.
    router.replace("/", { scroll: false });

    const t = setTimeout(() => setOpen(false), 8000);
    return () => clearTimeout(t);
  }, [router]);

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
        width: "min(520px, calc(100vw - 32px))",
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
          padding: "4px 8px",
          minWidth: 32,
          minHeight: 32,
        }}
      >
        ×
      </button>
    </div>
  );
}
