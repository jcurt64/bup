/**
 * Pastille de variation période-sur-période (maquette da.png) : fond
 * vert tendre + flèche ↗ pour une hausse, fond rouge tendre + flèche ↘
 * pour une baisse, pastille neutre « — » quand il n'y a pas de base de
 * comparaison (période précédente à 0).
 */
export default function Delta({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums whitespace-nowrap";

  if (previous === 0) {
    return (
      <span
        className={base}
        style={{
          background: "var(--ivory-2)",
          color: "var(--ink-5)",
          fontFamily: "var(--mono)",
        }}
      >
        —
      </span>
    );
  }

  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct > 0;
  const flat = pct === 0;

  const color = up ? "var(--good)" : flat ? "var(--ink-5)" : "var(--danger)";
  const bg = up
    ? "color-mix(in oklab, var(--good) 14%, var(--paper))"
    : flat
      ? "var(--ivory-2)"
      : "color-mix(in oklab, var(--danger) 13%, var(--paper))";
  const arrow = up ? "↗" : flat ? "→" : "↘";

  return (
    <span
      className={base}
      style={{ background: bg, color, fontFamily: "var(--mono)" }}
    >
      <span aria-hidden>{arrow}</span>
      {pct > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}
