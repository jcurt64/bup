// Filtres des sollicitations en attente (écran Relations) — prédicats et
// options IDENTIQUES au web (Prospect.jsx : relMatchAmount / relMatchDate /
// relMatchTier / relMatchDistance / REL_FILTERS). Réutilisés par la liste
// filtrée ET les compteurs par option.
import type { Relation } from "./queries";

export type RelFilterId = "amount" | "date" | "tier" | "distance";

export type RelFilterValues = {
  amount: string; // all | 1-2 | 2-5 | 5+
  date: string; // all | today | 3d | 7d
  tier: string; // all | 1..5
  distance: string; // all | 10 | 10-30 | 30
  flash: boolean;
};

export const REL_FILTER_DEFAULTS: RelFilterValues = {
  amount: "all",
  date: "all",
  tier: "all",
  distance: "all",
  flash: false,
};

export const REL_FILTERS: {
  id: RelFilterId;
  label: string;
  opts: { v: string; t: string; short: string }[];
}[] = [
  {
    id: "amount",
    label: "Montant",
    opts: [
      { v: "all", t: "Tous les montants", short: "Tous" },
      { v: "1-2", t: "1 – 2 €", short: "1 – 2 €" },
      { v: "2-5", t: "2 – 5 €", short: "2 – 5 €" },
      { v: "5+", t: "5 € et +", short: "5 € +" },
    ],
  },
  {
    id: "date",
    label: "Date",
    opts: [
      { v: "all", t: "Toutes les dates", short: "Toutes" },
      { v: "today", t: "Aujourd'hui", short: "Aujourd'hui" },
      { v: "3d", t: "3 derniers jours", short: "3 jours" },
      { v: "7d", t: "7 derniers jours", short: "7 jours" },
    ],
  },
  {
    id: "tier",
    label: "Palier",
    opts: [
      { v: "all", t: "Tous les paliers", short: "Tous" },
      { v: "1", t: "Palier 1", short: "Palier 1" },
      { v: "2", t: "Palier 2", short: "Palier 2" },
      { v: "3", t: "Palier 3", short: "Palier 3" },
      { v: "4", t: "Palier 4", short: "Palier 4" },
      { v: "5", t: "Palier 5", short: "Palier 5" },
    ],
  },
  {
    id: "distance",
    label: "Autour de moi",
    opts: [
      { v: "all", t: "Toutes les distances", short: "Toutes" },
      { v: "10", t: "À moins de 10 km", short: "≤ 10 km" },
      { v: "10-30", t: "Entre 10 et 30 km", short: "10–30 km" },
      { v: "30", t: "Plus de 30 km", short: "+30 km" },
    ],
  },
];

export function relMatchAmount(reward: number, v: string): boolean {
  if (v === "1-2") return reward >= 1 && reward < 2;
  if (v === "2-5") return reward >= 2 && reward < 5;
  if (v === "5+") return reward >= 5;
  return true;
}

export function relMatchDate(r: Pick<Relation, "sentAt" | "startDate">, v: string): boolean {
  if (v === "all") return true;
  const iso = r.sentAt ?? r.startDate;
  const t = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  const day = 86_400_000;
  const sot = new Date();
  sot.setHours(0, 0, 0, 0);
  if (v === "today") return t >= sot.getTime();
  if (v === "3d") return t >= now - 3 * day;
  if (v === "7d") return t >= now - 7 * day;
  return true;
}

export function relMatchTier(tier: number, v: string): boolean {
  if (v === "all") return true;
  return Number(tier) === Number(v);
}

// « Autour de moi » : sans distance connue, une sollicitation est exclue dès
// qu'un rayon est sélectionné (parité web).
export function relMatchDistance(distanceKm: number | null | undefined, v: string): boolean {
  if (v === "all") return true;
  if (distanceKm == null || Number.isNaN(distanceKm)) return false;
  if (v === "10") return distanceKm <= 10;
  if (v === "10-30") return distanceKm > 10 && distanceKm <= 30;
  if (v === "30") return distanceKm > 30;
  return true;
}

export function relMatchFilter(r: Relation, id: RelFilterId, v: string): boolean {
  if (id === "amount") return relMatchAmount(Number(r.reward) || 0, v);
  if (id === "date") return relMatchDate(r, v);
  if (id === "distance") return relMatchDistance(r.distanceKm, v);
  return relMatchTier(Number(r.tier), v);
}

export function applyRelFilters(list: Relation[], f: RelFilterValues): Relation[] {
  return list.filter(
    (r) =>
      relMatchAmount(Number(r.reward) || 0, f.amount) &&
      relMatchDate(r, f.date) &&
      relMatchTier(Number(r.tier), f.tier) &&
      relMatchDistance(r.distanceKm, f.distance) &&
      (!f.flash || r.isFlashDeal),
  );
}

export function relFiltersActive(f: RelFilterValues): boolean {
  return (
    f.amount !== "all" ||
    f.date !== "all" ||
    f.tier !== "all" ||
    f.distance !== "all" ||
    f.flash
  );
}

/** « Palier 3 » / « Paliers 1 – 3 – 5 » (parité web movementTierLabel). */
export function tierListLabel(r: { tier?: number | null; tiers?: number[] | null }): string {
  const list =
    Array.isArray(r.tiers) && r.tiers.length > 0 ? r.tiers : r.tier != null ? [r.tier] : [];
  const uniq = [
    ...new Set(
      list.map((n) => Math.round(Number(n) || 0)).filter((n) => n >= 1 && n <= 5),
    ),
  ].sort((a, b) => a - b);
  if (uniq.length === 0) return "Palier —";
  return `${uniq.length > 1 ? "Paliers" : "Palier"} ${uniq.join(" – ")}`;
}
