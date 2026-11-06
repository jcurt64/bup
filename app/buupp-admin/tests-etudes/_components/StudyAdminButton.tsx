"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function StudyAdminButton({
  url, body, label, confirmText, tone = "neutral",
}: {
  url: string;
  body?: Record<string, unknown>;
  label: string;
  confirmText?: string;
  tone?: "neutral" | "danger" | "good";
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const colors = { neutral: ["var(--ivory-2)", "var(--ink-2)"], danger: ["#FEE2E2", "#991B1B"], good: ["#DCFCE7", "#166534"] }[tone];

  const go = () => {
    if (confirmText && !armed) { setArmed(true); return; }
    setError(null);
    start(async () => {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
      if (!r.ok) { setError("Échec."); return; }
      setArmed(false);
      router.refresh();
    });
  };
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={go} disabled={pending}
        className="text-xs rounded px-3 py-1.5 disabled:opacity-60 cursor-pointer"
        style={{ background: colors[0], color: colors[1] }}>
        {armed ? confirmText : label}
      </button>
      {armed && <button type="button" className="text-xs underline" onClick={() => setArmed(false)}>annuler</button>}
      {error && <span className="text-xs" style={{ color: "#B91C1C" }}>{error}</span>}
    </span>
  );
}
