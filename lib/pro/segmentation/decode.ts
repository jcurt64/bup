import type { SegmentContact, TierKey } from "./types";

export type RelationInput = {
  relationId: string;
  prospectId: string;
  score: number;
  evaluation: "atteint" | "non_atteint" | null;
};

export type DecodeInput = {
  relations: RelationInput[];
  /** prospectId → paliers masqués/supprimés (removed ∪ hidden). */
  blockedByProspect: Map<string, Set<TierKey>>;
  /** palier → (prospectId → ligne brute de la table palier). */
  tierData: Partial<Record<TierKey, Map<string, Record<string, unknown>>>>;
  /** paliers payés par la campagne (requiredTiers → clés). */
  campaignTiers: TierKey[];
};

function s(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

export function decodeContacts(input: DecodeInput): SegmentContact[] {
  const { relations, blockedByProspect, tierData, campaignTiers } = input;
  const camp = new Set(campaignTiers);
  return relations.map((r) => {
    const blocked = blockedByProspect.get(r.prospectId) ?? new Set<TierKey>();
    const has = (k: TierKey) => camp.has(k) && !blocked.has(k);
    const row = (k: TierKey) => tierData[k]?.get(r.prospectId) ?? {};
    const c: SegmentContact = { relationId: r.relationId, score: r.score, reached: r.evaluation };
    if (has("identity")) {
      const t = row("identity");
      c.identity = { prenom: s(t.prenom), nom: s(t.nom) };
    }
    if (has("localisation")) {
      const t = row("localisation");
      c.localisation = { region: s(t.region), ville: s(t.ville), codePostal: s(t.code_postal), adresse: s(t.adresse) };
    }
    if (has("vie")) {
      const t = row("vie");
      c.vie = { foyer: s(t.foyer), sports: s(t.sports), animaux: s(t.animaux), vehicule: s(t.vehicule), logement: s(t.logement), mobilite: s(t.mobilite) };
    }
    if (has("pro")) {
      const t = row("pro");
      c.pro = { poste: s(t.poste), statut: s(t.statut), secteur: s(t.secteur), revenus: s(t.revenus) };
    }
    if (has("patrimoine")) {
      const t = row("patrimoine");
      c.patrimoine = { residence: s(t.residence), epargne: s(t.epargne), projets: s(t.projets) };
    }
    return c;
  });
}
