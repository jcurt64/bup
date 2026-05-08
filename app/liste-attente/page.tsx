"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function WaitlistPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { bupp?: string } | undefined;
      if (data?.bupp === "goLanding") {
        router.push("/");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router]);

  // Propage les query params (notamment `simulate-launch=Xmin` pour les
  // tests de countdown) au HTML statique chargé dans l'iframe.
  const qs = searchParams.toString();
  const src = qs ? `/prototype/waitlist.html?${qs}` : "/prototype/waitlist.html";

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
