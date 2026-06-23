"use client";

import { useId } from "react";
import AdminIcon, { type AdminIconName } from "./AdminIcon";

type Series = {
  label: string;
  values: number[];
  color: string;
  /** Trait pointillé (ex. « Expirées »). */
  dashed?: boolean;
};

export default function TimeseriesChart({
  title,
  labels,
  series,
  icon,
  height = 170,
}: {
  title: string;
  labels: string[];
  series: Series[];
  icon?: AdminIconName;
  height?: number;
}) {
  const uid = useId().replace(/[:]/g, "");
  const width = 600;
  const padTop = 12;
  const padBottom = 8;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const n = Math.max(labels.length - 1, 1);
  const stepX = width / n;

  const yOf = (v: number) =>
    height - padBottom - (v / max) * (height - padTop - padBottom);
  const xOf = (i: number) => i * stepX;

  const linePath = (values: number[]) =>
    values
      .map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`)
      .join(" ");

  // Aire remplie sous la 1re série (série « principale »).
  const primary = series[0];
  const areaPath =
    primary && primary.values.length > 0
      ? `${linePath(primary.values)} L${xOf(primary.values.length - 1).toFixed(1)},${height} L0,${height} Z`
      : "";

  return (
    <div
      className="rounded-xl p-4 sm:p-5"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon && (
          <span style={{ color: "var(--ink-4)" }}>
            <AdminIcon name={icon} size={16} />
          </span>
        )}
        <div
          style={{
            fontFamily: "var(--serif)",
            fontSize: "19px",
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
        {primary && (
          <defs>
            <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primary.color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={primary.color} stopOpacity={0} />
            </linearGradient>
          </defs>
        )}
        {areaPath && <path d={areaPath} fill={`url(#grad-${uid})`} stroke="none" />}
        {series.map((s) => (
          <path
            key={s.label}
            d={linePath(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.dashed ? "4 4" : undefined}
            opacity={s.dashed ? 0.7 : 1}
          />
        ))}
        {/* Point terminal de chaque série (rappel maquette). */}
        {series.map((s) =>
          s.values.length > 0 ? (
            <circle
              key={`dot-${s.label}`}
              cx={xOf(s.values.length - 1)}
              cy={yOf(s.values[s.values.length - 1])}
              r={3}
              fill={s.color}
            />
          ) : null,
        )}
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
