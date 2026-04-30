"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUTE_TO_PATH: Record<string, string> = {
  landing: "/",
  waitlist: "/waitlist",
  auth: "/auth",
  prospect: "/prospect",
  pro: "/pro",
};

export default function PrototypeFrame({
  route,
}: {
  route: "auth" | "prospect" | "pro" | "waitlist";
}) {
  const router = useRouter();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { bupp?: string; route?: string } | undefined;
      if (!data || data.bupp !== "goto") return;
      const target = data.route && ROUTE_TO_PATH[data.route];
      if (target) {
        if (target === "/waitlist") {
          try {
            sessionStorage.setItem("bupp:waitlist-ok", "1");
          } catch {}
        }
        router.push(target);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router]);

  return (
    <iframe
      src={`/prototype/shell.html#${route}`}
      title={`BUPP — ${route}`}
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
