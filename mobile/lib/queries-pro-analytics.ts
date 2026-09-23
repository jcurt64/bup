// Hooks complémentaires espace pro (Vue d'ensemble / Analytics) — parité web.
// Séparés de lib/queries.ts pour limiter les conflits d'édition.
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useApi } from "./api";
import type { ProOverview } from "./queries";

// — Toutes les acceptations — GET /api/pro/acceptances?page&size
// Alimente la modale « Voir tout » de « Dernières acceptations ». Le web
// plafonne à 50 (la route borne déjà size à 50).
export const ALL_ACCEPTANCES_MAX = 50;

export type ProAcceptance = ProOverview["lastAcceptances"][number];
export type ProAcceptancesPage = {
  page: number;
  size: number;
  total: number;
  rows: ProAcceptance[];
};

export function useProAcceptances(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: ["pro", "acceptances", ALL_ACCEPTANCES_MAX],
    queryFn: () =>
      api<ProAcceptancesPage>(
        `/api/pro/acceptances?page=1&size=${ALL_ACCEPTANCES_MAX}`,
      ),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
