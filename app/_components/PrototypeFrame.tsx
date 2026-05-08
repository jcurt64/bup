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
  // correspond pas à son rôle (cas théorique : CTA pas masqué côté
  // Landing), le trigger BDD côté /{role} déclenchera RoleConflictError →
  // redirect / + toast.
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
  const { isSignedIn } = useUser();

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const data = e.data as
        | { bupp?: string; route?: string }
        | undefined;
      if (!data?.bupp) return;
      if (data.bupp === "signOut") {
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
  }, [router, signOut, isSignedIn]);

  const hash = tab ? `${route}?tab=${encodeURIComponent(tab)}` : route;
  // Cache-bust uniquement côté client : `Date.now()` au render initial
  // SSR donnerait un timestamp différent du client → mismatch
  // d'hydratation. On rend donc l'iframe avec une URL stable au premier
  // pass, puis on la remonte avec un suffixe `?v=...` après hydratation.
  const [cacheBust, setCacheBust] = useState<number | null>(null);
  useEffect(() => {
    setCacheBust(Date.now());
  }, []);

  const baseSrc = `/prototype/shell.html#${hash}`;
  const src = cacheBust ? `/prototype/shell.html?v=${cacheBust}#${hash}` : baseSrc;

  return (
    <iframe
      key={cacheBust ?? "ssr"}
      src={src}
      title={`BUUPP — ${route}`}
      style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        border: 0, display: "block", background: "#F7F4EC",
      }}
    />
  );
}
