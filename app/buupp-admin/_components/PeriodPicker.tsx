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
    // Pastille sombre avec icône calendrier + chevron (maquette da.png).
    // Le <select> natif est rendu transparent et couvre toute la pastille
    // pour rester accessible/cliquable ; les icônes sont en overlay.
    <label
      className="relative inline-flex items-center rounded-full h-10 cursor-pointer"
      style={{ background: "var(--ink)", color: "var(--paper)" }}
    >
      <span
        className="absolute left-3 inline-flex pointer-events-none"
        style={{ color: "var(--paper)" }}
        aria-hidden
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </span>
      <select
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(sp.toString());
          next.set("period", e.target.value);
          router.push(`${pathname}?${next.toString()}`);
        }}
        className="appearance-none bg-transparent text-sm font-medium h-10 cursor-pointer"
        style={{
          color: "var(--paper)",
          border: "none",
          outline: "none",
          paddingLeft: 34,
          paddingRight: 32,
          fontFamily: "var(--sans)",
        }}
      >
        {OPTIONS.map((o) => (
          // Les options héritent du thème système (fond clair) → on force
          // un texte sombre pour rester lisible dans la liste déroulante.
          <option key={o.value} value={o.value} style={{ color: "#0F172A" }}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        className="absolute right-3 inline-flex pointer-events-none"
        style={{ color: "var(--paper)" }}
        aria-hidden
      >
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 1.5 6 6.5 11 1.5" />
        </svg>
      </span>
    </label>
  );
}
