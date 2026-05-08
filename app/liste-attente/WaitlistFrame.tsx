"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Wrapper client minimal autour de l'iframe waitlist : écoute le
 * postMessage `bupp:goLanding` envoyé depuis le HTML statique pour
 * revenir à la home, et délègue la navigation au router Next.js.
 * Le `src` est calculé en amont par le Server Component parent
 * (pour ne pas devoir utiliser useSearchParams ici, qui force
 * la page à bailler-out du static generation).
 */
export default function WaitlistFrame({ src }: { src: string }) {
  const router = useRouter();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { bupp?: string } | undefined;
      if (data?.bupp === "goLanding") {
        router.push("/");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router]);

  return (
    <iframe
      src={src}
      title="BUUPP — Liste d'attente"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: 0,
        display: "block",
        background: "#F7F4EC",
      }}
    />
  );
}
