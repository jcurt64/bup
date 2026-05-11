"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";

const OPTIONS: { value: string; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "quarter", label: "Trimestre" },
  { value: "12m", label: "12 mois" },
  { value: "all", label: "Tout" },
];

export default function PeriodPicker() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = sp.get("period") ?? "30d";

  return (
    <select
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        next.set("period", e.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}
      className="admin-select rounded-md text-sm h-10 px-3 cursor-pointer"
      style={{
        background: "var(--paper)",
        color: "var(--ink)",
        border: "1px solid var(--line)",
        fontFamily: "var(--sans)",
      }}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
