/**
 * Conteneur centré partagé par les pages d'authentification
 * (/connexion, /inscription/{prospect,pro}). Centralise le layout
 * <main> dupliqué entre la branche widget Clerk et la branche
 * bannière de conflit. Aucune logique — purement présentation.
 */
import type { ReactNode } from "react";

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px 96px",
        background: "var(--ivory)",
      }}
    >
      {children}
    </main>
  );
}
