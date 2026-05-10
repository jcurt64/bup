import Delta from "./Delta";
import Sparkline from "./Sparkline";

export default function KpiCard({
  label,
  value,
  unit,
  current,
  previous,
  spark,
}: {
  label: string;
  value: string;
  unit?: string;
  current: number;
  previous: number;
  spark?: number[];
}) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-2"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      <div
        className="text-[11px] uppercase"
        style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
      >
        {label}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div
          className="tabular-nums"
          style={{
            fontFamily: "var(--serif)",
            fontSize: "26px",
            fontWeight: 400,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {value}
          {unit && (
            <span
              style={{
                fontSize: "14px",
                fontFamily: "var(--sans)",
                color: "var(--ink-4)",
                marginLeft: "4px",
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
