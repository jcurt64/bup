export default function Sparkline({
  values,
  width = 80,
  height = 24,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);
  const path = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} style={{ color: "var(--accent)" }}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}
