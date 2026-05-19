"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";

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
  version,
}: {
  route: "auth" | "prospect" | "pro" | "waitlist";
  tab?: string | null;
  // Jeton de cache-bust stable par déploiement, fourni par le Server
  // Component parent (cf. lib/prototype/version.ts).
  version: string;
}) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as
        | { bupp?: string; route?: string }
        | undefined;
      if (!data?.bupp) return;
      if (data.bupp === "signOut") {
        // La sidebar du proto (Pro.jsx / Prospect.jsx) affiche déjà sa
        // propre SignOutConfirmModal AVANT d'envoyer ce message. Pas
        // besoin de re-confirmer ici — sinon double modale.
        try {
          await signOut({ redirectUrl: "/" });
        } catch (err) {
          console.error("[PrototypeFrame] signOut failed", err);
        }
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
  }, [router, signOut, isSignedIn, isLoaded]);

  const hash = tab ? `${route}?tab=${encodeURIComponent(tab)}` : route;
  // Cache-bust STABLE par déploiement (cf. lib/prototype/version.ts) :
  // valeur identique côté serveur et client → on rend l'URL versionnée
  // dès le premier pass (aucun mismatch d'hydratation) et SANS
  // remontage post-hydratation. Bénéfices vs l'ancien `Date.now()` :
  //  - une seule charge d'iframe au lieu de deux (plus de remount) ;
  //  - les .jsx sont servis depuis le cache navigateur tant que le
  //    déploiement ne change pas (header immutable, cf. next.config.ts).
  const src = `/prototype/shell.html?v=${encodeURIComponent(version)}#${hash}`;

  // Loader le temps que l'iframe charge shell.html + JSX (premier
  // affichage uniquement : ensuite tout est en cache). Sans ça
  // l'utilisateur perçoit la page comme "vide" et croit à un bug.
  // Pas d'effet de reset : un changement de route majeure remonte tout
  // PrototypeFrame (page Next distincte) → l'état repart à `false`
  // naturellement ; les changements d'onglet se font dans l'iframe
  // (hash interne) sans re-rendu du parent.
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <>
      <iframe
        key={version}
        src={src}
        title={`BUUPP — ${route}`}
        onLoad={() => setIframeLoaded(true)}
        style={{
          position: "fixed", inset: 0, width: "100%", height: "100%",
          border: 0, display: "block", background: "#F7F4EC",
        }}
      />
      {!iframeLoaded && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F7F4EC",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "3px solid rgba(15, 22, 41, 0.12)",
              borderTopColor: "#4F46E5",
              animation: "bupp-spin .8s linear infinite",
            }}
          />
          <style>{`@keyframes bupp-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </>
  );
}
