"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";

const ROUTE_TO_PATH: Record<string, string> = {
  landing: "/",
  waitlist: "/liste-attente",
  auth: "/connexion",
  prospect: "/prospect",
  pro: "/pro",
};

export default function PrototypeFrame({
  route,
  tab,
}: {
  route: "auth" | "prospect" | "pro" | "waitlist";
  tab?: string | null;
}) {
  const router = useRouter();
  const { signOut } = useClerk();

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const data = e.data as
        | { bupp?: string; route?: string }
        | undefined;
      if (!data?.bupp) return;
      if (data.bupp === "signOut") {
        await signOut({ redirectUrl: "/" });
        return;
      }
      if (data.bupp === "goto") {
        const target = data.route && ROUTE_TO_PATH[data.route];
        if (!target) return;
        if (target === "/liste-attente") {
          try { sessionStorage.setItem("bupp:waitlist-ok", "1"); } catch {}
        }
        router.push(target);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router, signOut]);

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
