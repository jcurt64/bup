"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";

export type Role = "prospect" | "pro";

const ROLE_LABEL: Record<Role, string> = {
  prospect: "prospect",
  pro: "professionnel",
};

/**
 * Lit le rôle de l'utilisateur connecté depuis Clerk publicMetadata
 * (cache instantané) et fait un fallback DB via /api/me/role si la
 * metadata est absente — ce qui peut arriver juste après le signup
 * tant que le webhook n'a pas re-synchronisé Clerk.
 */
function useCurrentRole(): { signedIn: boolean; role: Role | null; ready: boolean } {
  const { isLoaded, isSignedIn, user } = useUser();
  const [dbRole, setDbRole] = useState<Role | null>(null);
  const [dbChecked, setDbChecked] = useState(false);

  const cachedRole =
    (user?.publicMetadata as { role?: Role } | undefined)?.role ?? null;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setDbChecked(true);
      return;
    }
    if (cachedRole) {
      setDbChecked(true);
      return;
    }
    let cancelled = false;
    fetch("/api/me/role", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { role?: Role | null } | null) => {
        if (cancelled) return;
        setDbRole(j?.role ?? null);
        setDbChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDbChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, cachedRole]);

  return {
    signedIn: !!isSignedIn,
    role: cachedRole ?? dbRole,
    ready: isLoaded && (!isSignedIn || cachedRole != null || dbChecked),
  };
}

/**
 * Hook principal : retourne `guard(targetRole, href)` à utiliser sur
 * tous les boutons qui mènent à /prospect ou /pro. Si l'utilisateur
 * est connecté avec un rôle incompatible, on ouvre le modal au lieu
 * de naviguer ; sinon on suit l'URL.
 *
 * Usage typique :
 *   const { guard, modal } = useRoleGuard();
 *   <button onClick={() => guard("prospect", "/prospect")}>…</button>
 *   {modal}
 */
export function useRoleGuard() {
  const router = useRouter();
  const { signedIn, role, ready } = useCurrentRole();
  const [conflict, setConflict] = useState<{
    currentRole: Role;
    targetRole: Role;
    intendedHref: string;
  } | null>(null);

  const guard = useCallback(
    (targetRole: Role, intendedHref: string) => {
      if (!ready) {
        // Tant que le rôle n'est pas chargé, on laisse passer — le
        // garde serveur dans /prospect|/pro reste la dernière ligne
        // de défense en cas de mismatch non détecté côté client.
        router.push(intendedHref);
        return;
      }
      if (!signedIn || !role || role === targetRole) {
        router.push(intendedHref);
        return;
      }
      setConflict({ currentRole: role, targetRole, intendedHref });
    },
    [ready, signedIn, role, router],
  );

  return {
    guard,
    modal: conflict ? (
      <RoleSwitchModal
        currentRole={conflict.currentRole}
        targetRole={conflict.targetRole}
        onClose={() => setConflict(null)}
      />
    ) : null,
  };
}

function RoleSwitchModal({
  currentRole,
  targetRole,
  onClose,
}: {
  currentRole: Role;
  targetRole: Role;
  onClose: () => void;
}) {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);

  // ESC pour fermer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const doSignOut = async () => {
    setBusy(true);
    try {
      // Redirige vers /connexion : l'utilisateur se reconnecte avec
      // l'autre compte (ou en crée un nouveau via /inscription).
      await signOut({ redirectUrl: "/connexion" });
    } catch (err) {
      console.error("[RoleSwitchModal] signOut failed", err);
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-switch-title"
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
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        style={{
          background: "var(--paper, #FBF9F3)",
          color: "var(--ink, #0F1629)",
          borderRadius: 16,
          width: "min(480px, 100%)",
          padding: "28px 26px 22px",
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
          Changement de profil
        </div>
        <h2
          id="role-switch-title"
          style={{
            fontSize: 22,
            lineHeight: 1.25,
            margin: 0,
            marginBottom: 12,
            fontWeight: 500,
            fontFamily: "var(--serif, Georgia, serif)",
          }}
        >
          Vous êtes connecté en tant que{" "}
          <em style={{ color: "var(--accent, #4F46E5)" }}>
            {ROLE_LABEL[currentRole]}
          </em>
          .
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
          L&apos;espace <strong>{ROLE_LABEL[targetRole]}</strong> n&apos;est pas
          accessible depuis ce compte. Pour des raisons de sécurité et de
          séparation des données, un même compte ne peut pas avoir les deux
          profils. Déconnectez-vous puis reconnectez-vous avec un compte{" "}
          {ROLE_LABEL[targetRole]} pour y accéder.
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
            onClick={onClose}
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
            onClick={doSignOut}
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
