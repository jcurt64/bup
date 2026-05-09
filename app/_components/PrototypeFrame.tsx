"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import LogoutConfirmModal from "./LogoutConfirmModal";

const STATIC_ROUTES: Record<string, string> = {
  landing: "/",
  waitlist: "/liste-attente",
  auth: "/connexion",
};

// `prospect` et `pro` sont dynamiques : si l'utilisateur n'est pas connecté,
// on l'envoie sur la page d'inscription dédiée (sinon le middleware Clerk
// renverrait sur /connexion, ce qui rate la sélection de rôle).
function resolveRoleRoute(intent: "prospect" | "pro", isSignedIn: boolean): string {
  if (!isSignedIn) {
    return intent === "prospect" ? "/inscription/prospect" : "/inscription/pro";
  }
  // L'utilisateur connecté est routé vers son espace. Si l'intent ne
  // correspond pas à son rôle, le trigger BDD côté /{role} déclenche
  // RoleConflictError → redirect / + toast. Pas besoin de connaître le
  // rôle ici (simplification volontaire vs le plan).
  return intent === "prospect" ? "/prospect" : "/pro";
}

export default function PrototypeFrame({
  route,
  tab,
}: {
  route: "auth" | "prospect" | "pro" | "waitlist";
  tab?: string | null;
}) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isSignedIn, isLoaded } = useUser();
  // Le shell iframe (sidebar /pro et /prospect) demande la déconnexion
  // via postMessage `bupp:signOut`. On intercale ici une confirmation
  // modale — cohérente avec le bouton "Se déconnecter" du header.
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as
        | { bupp?: string; route?: string }
        | undefined;
      if (!data?.bupp) return;
      if (data.bupp === "signOut") {
        setLogoutOpen(true);
        return;
      }
      if (data.bupp === "goto") {
        const r = data.route;
        if (!r) return;

        if (r === "prospect" || r === "pro") {
          // Pendant l'hydratation Clerk (`isSignedIn === undefined`), on ne route
          // pas — un utilisateur connecté serait sinon envoyé sur /inscription/{role}.
          // L'utilisateur peut recliquer une fois Clerk prêt (sub-200ms typiquement).
          if (!isLoaded) return;
          const target = resolveRoleRoute(r, !!isSignedIn);
          router.push(target);
          return;
        }

        const staticTarget = STATIC_ROUTES[r];
        if (!staticTarget) return;
        if (staticTarget === "/liste-attente") {
          try { sessionStorage.setItem("bupp:waitlist-ok", "1"); } catch {}
        }
        router.push(staticTarget);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router, isSignedIn, isLoaded]);

  const hash = tab ? `${route}?tab=${encodeURIComponent(tab)}` : route;
  // Cache-bust uniquement côté client : `Date.now()` au render initial
  // SSR donnerait un timestamp différent du client → mismatch
  // d'hydratation. On rend donc l'iframe avec une URL stable au premier
  // pass, puis on la remonte avec un suffixe `?v=...` après hydratation.
  // Cela force le navigateur à recharger shell.html (et donc les
  // scripts JSX qu'il référence) à chaque navigation client.
  const [cacheBust, setCacheBust] = useState<number | null>(null);
  useEffect(() => {
    setCacheBust(Date.now());
  }, []);

  const baseSrc = `/prototype/shell.html#${hash}`;
  const src = cacheBust ? `/prototype/shell.html?v=${cacheBust}#${hash}` : baseSrc;

  return (
    <>
      <iframe
        key={cacheBust ?? "ssr"}
        src={src}
        title={`BUUPP — ${route}`}
        style={{
          position: "fixed", inset: 0, width: "100%", height: "100%",
          border: 0, display: "block", background: "#F7F4EC",
        }}
      />
      <LogoutConfirmModal
        open={logoutOpen}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={async () => {
          try {
            await signOut({ redirectUrl: "/" });
          } catch (err) {
            console.error("[PrototypeFrame] signOut failed", err);
          }
        }}
      />
    </>
  );
}
