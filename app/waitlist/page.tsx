"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WaitlistPage() {
  const router = useRouter();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { bupp?: string } | undefined;
      if (data?.bupp === "goLanding") router.push("/");
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router]);

  return (
    <iframe
      src="/prototype/waitlist.html"
      title="BUPP — Liste d'attente"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: 0,
        display: "block",
        background: "#080808",
      }}
    />
  );
}
