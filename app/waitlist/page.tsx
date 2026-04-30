"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const WAITLIST_OK_KEY = "bupp:waitlist-ok";

export default function WaitlistPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const ok = sessionStorage.getItem(WAITLIST_OK_KEY) === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllowed(ok);
    if (!ok) router.replace("/");
  }, [router]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { bupp?: string } | undefined;
      if (data?.bupp === "goLanding") {
        sessionStorage.removeItem(WAITLIST_OK_KEY);
        router.push("/");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router]);

  if (allowed !== true) return null;

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
        background: "#F7F4EC",
      }}
    />
  );
}
