export default function Delta({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous === 0) {
    return <span className="text-xs text-neutral-400">—</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? "+" : "";
  const tone = pct > 0 ? "text-emerald-600" : pct < 0 ? "text-rose-600" : "text-neutral-500";
  return <span className={`text-xs font-medium ${tone}`}>{sign}{pct}%</span>;
}
