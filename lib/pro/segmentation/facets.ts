import type { SegmentContact, AudienceFacets, FacetCount } from "./types";

/** Facettes de l'audience. Plus aucune facette catégorielle (les données
 *  des anciens paliers n'existent plus) : score + statut d'atteinte seuls.
 *  Le 2e argument (paliers autorisés) est conservé pour compatibilité. */
export function buildFacets(contacts: SegmentContact[], _allowedTiers: readonly string[] = []): AudienceFacets {
  void _allowedTiers;
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

  return { total: contacts.length, score, reached };
}
