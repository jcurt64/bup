"use client";

type Series = { label: string; values: number[]; color: string };

export default function TimeseriesChart({
  title,
  labels,
  series,
  height = 160,
}: {
  title: string;
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const width = 600;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const stepX = width / Math.max(labels.length - 1, 1);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-sm font-medium mb-3">{title}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {series.map((s) => {
          const path = s.values
            .map((v, i) => {
              const x = i * stepX;
              const y = height - (v / max) * (height - 10);
              return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          return <path key={s.label} d={path} fill="none" stroke={s.color} strokeWidth={1.5} />;
        })}
      </svg>
      <div className="flex gap-3 mt-2 text-xs">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
