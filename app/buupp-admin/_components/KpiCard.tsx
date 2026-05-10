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
    <div className="rounded-lg border border-neutral-200 bg-white p-4 flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-semibold tabular-nums">
          {value}
          {unit && <span className="text-sm font-normal text-neutral-500 ml-1">{unit}</span>}
        </div>
        <Delta current={current} previous={previous} />
      </div>
      {spark && <Sparkline values={spark} />}
    </div>
  );
}
