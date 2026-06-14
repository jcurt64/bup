import type { SegmentContact, TierKey, CategoricalKey, AudienceFacets, FacetCount } from "./types";
import { distanceBand } from "@/lib/pro/pseudonymize";

const TOP_N = 12;

// Ordre logique des tranches de distance (sinon countCategory trie par effectif).
const DISTANCE_ORDER = [
  "< 2 km du centre",
  "2–5 km du centre",
  "5–10 km du centre",
  "10–20 km du centre",
  "> 20 km du centre",
];

const CATEGORICAL: { key: CategoricalKey; tier: TierKey; get: (c: SegmentContact) => string | null | undefined }[] = [
  { key: "region", tier: "localisation", get: (c) => c.localisation?.region },
  { key: "distance", tier: "localisation", get: (c) => distanceBand(c.localisation?.centerDistanceM) },
  { key: "logement", tier: "vie", get: (c) => c.vie?.logement },
  { key: "statutPro", tier: "pro", get: (c) => c.pro?.statut },
  { key: "foyer", tier: "vie", get: (c) => c.vie?.foyer },
  { key: "vehicule", tier: "vie", get: (c) => c.vie?.vehicule },
  { key: "animaux", tier: "vie", get: (c) => c.vie?.animaux },
];

function countCategory(contacts: SegmentContact[], get: (c: SegmentContact) => string | null | undefined): FacetCount[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    const v = (get(c) ?? "").trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
  if (sorted.length <= TOP_N) return sorted;
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N).reduce((acc, x) => acc + x.count, 0);
  top.push({ value: "Autres", count: rest });
  return top;
}

export function buildFacets(contacts: SegmentContact[], allowedTiers: TierKey[]): AudienceFacets {
  const allowed = new Set(allowedTiers);

  let lo = 0, mid = 0, hi = 0;
  for (const c of contacts) {
    if (c.score >= 720) hi++;
    else if (c.score >= 600) mid++;
    else lo++;
  }
  const score = [
    { label: "< 600", count: lo },
    { label: "600 – 719", count: mid },
    { label: "≥ 720", count: hi },
  ];

  const reachedCounts = new Map<string, number>();
  for (const c of contacts) {
    const k = c.reached === "atteint" ? "Atteint" : c.reached === "non_atteint" ? "Non atteint" : "Non évalué";
    reachedCounts.set(k, (reachedCounts.get(k) ?? 0) + 1);
  }
  const reached: FacetCount[] = [...reachedCounts.entries()].map(([value, count]) => ({ value, count }));

  const out: AudienceFacets = { total: contacts.length, score, reached };
  for (const f of CATEGORICAL) {
    if (!allowed.has(f.tier)) continue;
    out[f.key] = countCategory(contacts, f.get);
  }
  // La distance se trie logiquement (proche → lointain), pas par effectif.
  if (out.distance) {
    out.distance = [...out.distance].sort(
      (a, b) => DISTANCE_ORDER.indexOf(a.value) - DISTANCE_ORDER.indexOf(b.value),
    );
  }
  return out;
}
