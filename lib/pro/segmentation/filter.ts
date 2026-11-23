import type { SegmentContact, SegmentFilters } from "./types";

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function searchableText(c: SegmentContact): string {
  return norm([c.identity?.prenom, c.identity?.nom].filter(Boolean).join(" "));
}

export function matchesFilters(c: SegmentContact, f: SegmentFilters): boolean {
  if (f.scoreMin != null && c.score < f.scoreMin) return false;
  if (f.scoreMax != null && c.score > f.scoreMax) return false;
  if (f.reached && c.reached !== f.reached) return false;
  if (f.q && f.q.trim()) {
    if (!searchableText(c).includes(norm(f.q))) return false;
  }
  return true;
}

/** Normalise les filtres reçus. Les anciennes clés catégorielles (région,
 *  distance, logement…) portaient sur des données supprimées : elles sont
 *  ignorées (un segment enregistré avec ces filtres reste utilisable). */
export function sanitizeFilters(raw: unknown): SegmentFilters {
  const out: SegmentFilters = {};
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const sMin = num(o.scoreMin);
  if (sMin != null) out.scoreMin = sMin;
  const sMax = num(o.scoreMax);
  if (sMax != null) out.scoreMax = sMax;
  if (o.reached === "atteint" || o.reached === "non_atteint") out.reached = o.reached;
  if (typeof o.q === "string" && o.q.trim()) out.q = o.q.trim().slice(0, 100);
  return out;
}
