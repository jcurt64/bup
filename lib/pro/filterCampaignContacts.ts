/**
 * Filtrage pur de la liste « Contacts obtenus » d'une campagne.
 * Utilisé par GET /api/pro/campaigns/[id] (filtres optionnels Statut /
 * Score / Période). Pur & déterministe → testé unitairement.
 *
 * Note : seuls les statuts « accepted » (En séquestre) et « settled »
 * (Crédité) constituent la liste des contacts (les autres relations ne
 * sont pas des contacts obtenus). `status=all` = ces deux-là.
 */

export type ContactStatusFilter = "all" | "accepted" | "settled";
export type ContactPeriodFilter = "7d" | "30d" | "90d" | "all";

export type CampaignContact = {
  id: string;
  prospectId: string;
  name: string;
  score: number | null;
  tierLabel: string;
  decidedAt: string;
  statusLabel: string;
  statusChip: string;
  status: string;
};

function periodCutoffMs(period: ContactPeriodFilter): number | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return Date.now() - days * 86_400_000;
}

export function filterCampaignContacts(
  contacts: CampaignContact[],
  opts: {
    status: ContactStatusFilter;
    scoreMin: number | null;
    period: ContactPeriodFilter;
  },
): CampaignContact[] {
  const cutoff = periodCutoffMs(opts.period);
  return contacts.filter((c) => {
    if (opts.status === "accepted" && c.status !== "accepted") return false;
    if (opts.status === "settled" && c.status !== "settled") return false;
    if (opts.scoreMin != null && (c.score == null || c.score < opts.scoreMin)) {
      return false;
    }
    if (cutoff != null) {
      const t = new Date(c.decidedAt).getTime();
      if (!Number.isFinite(t) || t < cutoff) return false;
    }
    return true;
  });
}
