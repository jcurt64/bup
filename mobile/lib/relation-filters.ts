// Filtres des sollicitations en attente (écran Relations) — prédicats et
// options IDENTIQUES au web (Prospect.jsx : relMatchAmount / relMatchDate /
// REL_FILTERS). Pivot mise en relation : plus de filtre palier ni distance. Réutilisés par la liste
// filtrée ET les compteurs par option.
import type { Relation } from "./queries";

export type RelFilterId = "amount" | "date";

export type RelFilterValues = {
  amount: string; // all | 1-2 | 2-5 | 5+
  date: string; // all | today | 3d | 7d
  flash: boolean;
};

export const REL_FILTER_DEFAULTS: RelFilterValues = {
  amount: "all",
  date: "all",
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

export function relMatchFilter(r: Relation, id: RelFilterId, v: string): boolean {
  if (id === "amount") return relMatchAmount(Number(r.reward) || 0, v);
  return relMatchDate(r, v);
}

export function applyRelFilters(list: Relation[], f: RelFilterValues): Relation[] {
  return list.filter(
    (r) =>
      relMatchAmount(Number(r.reward) || 0, f.amount) &&
      relMatchDate(r, f.date) &&
      (!f.flash || r.isFlashDeal),
  );
}

export function relFiltersActive(f: RelFilterValues): boolean {
  return (
    f.amount !== "all" ||
    f.date !== "all" ||
    f.flash
  );
}
