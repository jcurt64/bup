import Delta from "./Delta";
import Sparkline from "./Sparkline";
import AdminIcon, { type AdminIconName } from "./AdminIcon";

export default function KpiCard({
  label,
  value,
  unit,
  current,
  previous,
  spark,
  icon,
  accent = "var(--accent)",
}: {
  label: string;
  value: string;
  unit?: string;
  current: number;
  previous: number;
  spark?: number[];
  /** Icône affichée dans la pastille teintée (maquette da.png). */
  icon?: AdminIconName;
  /** Couleur d'accent : bordure gauche + teinte de la pastille d'icône. */
  accent?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 sm:p-[18px] flex flex-col gap-3"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderLeft: `4px solid ${accent}`,
        boxShadow: "var(--shadow-1)",
      }}
    >
      <div className="flex items-center gap-2.5">
        {icon && (
          <span
            className="inline-flex items-center justify-center rounded-[10px] shrink-0"
            style={{
              width: 34,
              height: 34,
              background: `color-mix(in oklab, ${accent} 14%, var(--paper))`,
              color: accent,
            }}
          >
            <AdminIcon name={icon} size={18} />
          </span>
        )}
        <div
          className="text-[11px] font-bold uppercase leading-tight"
          style={{
            color: "var(--ink-4)",
            fontFamily: "var(--mono)",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div
          className="tabular-nums"
          style={{
            fontFamily: "var(--serif)",
            fontSize: "30px",
            lineHeight: 1,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
          }}
        >
          {value}
          {unit && (
            <span
              style={{
                fontSize: "16px",
                fontFamily: "var(--sans)",
                color: "var(--ink-4)",
                marginLeft: "3px",
                fontWeight: 400,
              }}
            >
              {unit}
            </span>
          )}
        </div>
        <Delta current={current} previous={previous} />
      </div>
      {spark && <Sparkline values={spark} />}
    </div>
  );
}
