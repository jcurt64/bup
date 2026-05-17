"use client";

/**
 * Bannière affichée à la place du widget Clerk quand l'utilisateur
 * vient de s'authentifier mais que son compte est d'un rôle opposé à
 * l'intent du bouton. Mêmes largeur / rayon / ombre que la carte
 * Clerk → perçue comme faisant partie de la fenêtre d'auth.
 *
 * L'utilisateur est ICI déjà authentifié (le conflit n'est
 * déterminable qu'après auth) : on ne ré-affiche pas de formulaire,
 * on propose deux issues — rejoindre son espace réel, ou se
 * déconnecter pour utiliser une autre adresse.
 */
import Link from "next/link";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import type { Role } from "@/lib/sync/ensureRole";

const LABEL: Record<Role, string> = {
  pro: "professionnel",
  prospect: "particulier",
};

export default function AuthConflictBanner({
  existingRole,
  intent,
}: {
  existingRole: Role;
  intent: Role;
}) {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);

  const useAnother = async () => {
    setBusy(true);
    try {
      await signOut({ redirectUrl: `/connexion?intent=${intent}` });
    } catch (err) {
      console.error("[AuthConflictBanner] signOut failed", err);
      setBusy(false);
    }
  };

  return (
    <div
      aria-labelledby="auth-conflict-title"
      style={{
        width: "100%",
        maxWidth: 440,
        background: "var(--paper, #FFFEF8)",
        color: "var(--ink, #0F1629)",
        border: "1px solid var(--line, #EAE3D0)",
        borderRadius: 16,
        boxShadow: "0 18px 48px -16px rgba(15, 22, 41, .18)",
        padding: "28px 26px 24px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#B45309",
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        Adresse déjà utilisée
      </div>
      <h2
        id="auth-conflict-title"
        style={{
          fontSize: 21,
          lineHeight: 1.25,
          margin: "0 0 12px",
          fontWeight: 500,
          fontFamily: "var(--serif, Georgia, serif)",
        }}
      >
        Cette adresse e-mail est déjà associée à un compte{" "}
        <em style={{ color: "#7C3AED" }}>{LABEL[existingRole]}</em>.
      </h2>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: "#3A4150",
          margin: "0 0 22px",
        }}
      >
        Vous ne pouvez pas l&apos;utiliser pour un compte{" "}
        {LABEL[intent]}. Une adresse e-mail = un seul compte.
      </p>

      <Link
        href={`/${existingRole}`}
        style={{
          display: "block",
          textAlign: "center",
          background: "var(--ink, #0F1629)",
          color: "#fff",
          padding: "12px 16px",
          borderRadius: 10,
          textDecoration: "none",
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        Accéder à mon espace {LABEL[existingRole]}
      </Link>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={useAnother}
        style={{
          width: "100%",
          background: "transparent",
          color: "#5b6478",
          border: "1px solid var(--line, #EAE3D0)",
          padding: "11px 16px",
          borderRadius: 10,
          fontWeight: 500,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Déconnexion…" : "Utiliser une autre adresse"}
      </button>
    </div>
  );
}
