import type { SegmentContact, SegmentFilters, CategoricalKey } from "./types";
import { distanceBand } from "@/lib/pro/pseudonymize";

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const CATEGORICAL_GET: Record<CategoricalKey, (c: SegmentContact) => string | null | undefined> = {
  region: (c) => c.localisation?.region,
  distance: (c) => distanceBand(c.localisation?.centerDistanceM),
  logement: (c) => c.vie?.logement,
  statutPro: (c) => c.pro?.statut,
  foyer: (c) => c.vie?.foyer,
  vehicule: (c) => c.vie?.vehicule,
  animaux: (c) => c.vie?.animaux,
};

const CATEGORICAL_KEYS = Object.keys(CATEGORICAL_GET) as CategoricalKey[];

function searchableText(c: SegmentContact): string {
  const parts = [
    c.identity?.prenom, c.identity?.nom,
    c.localisation?.region, c.localisation?.ville, c.localisation?.adresse,
    c.vie?.sports, c.vie?.foyer, c.vie?.vehicule, c.vie?.logement, c.vie?.mobilite, c.vie?.animaux,
    c.pro?.poste, c.pro?.statut, c.pro?.secteur, c.pro?.revenus,
    c.patrimoine?.residence, c.patrimoine?.epargne, c.patrimoine?.projets,
  ];
  return norm(parts.filter(Boolean).join(" "));
}

export function matchesFilters(c: SegmentContact, f: SegmentFilters): boolean {
  if (f.scoreMin != null && c.score < f.scoreMin) return false;
  if (f.scoreMax != null && c.score > f.scoreMax) return false;
  if (f.reached && c.reached !== f.reached) return false;
  for (const key of CATEGORICAL_KEYS) {
    const wanted = f[key];
    if (wanted && wanted.length > 0) {
      const v = (CATEGORICAL_GET[key](c) ?? "").trim();
      if (!v || !wanted.includes(v)) return false;
    }
  }
  if (f.q && f.q.trim()) {
    if (!searchableText(c).includes(norm(f.q))) return false;
  }
  return true;
}

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
  for (const key of CATEGORICAL_KEYS) {
    const v = o[key];
    if (Array.isArray(v)) {
      const arr = v.filter((x): x is string => typeof x === "string").map((s) => s.slice(0, 80)).slice(0, 50);
      if (arr.length > 0) out[key] = arr;
    }
  }
  return out;
}
