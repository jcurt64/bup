export default function Delta({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous === 0) {
    return (
      <span className="text-xs" style={{ color: "var(--ink-5)" }}>
        —
      </span>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? "+" : "";
  const color =
    pct > 0 ? "var(--good)" : pct < 0 ? "var(--danger)" : "var(--ink-5)";
  return (
    <span
      className="text-xs font-medium tabular-nums"
      style={{ color, fontFamily: "var(--mono)" }}
    >
      {sign}
      {pct}%
    </span>
  );
}
