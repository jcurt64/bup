import type { SegmentContact } from "./types";
import { nomInitial } from "@/lib/campaigns/contact-channels";

export type RelationInput = {
  relationId: string;
  prospectId: string;
  score: number;
  evaluation: "atteint" | "non_atteint" | null;
};

export type DecodeInput = {
  relations: RelationInput[];
  /** prospectId → ligne brute prospect_identity (prenom, nom). */
  identityByProspect: Map<string, Record<string, unknown>>;
};

function s(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

export function decodeContacts(input: DecodeInput): SegmentContact[] {
  const { relations, identityByProspect } = input;
  return relations.map((r) => {
    const t = identityByProspect.get(r.prospectId) ?? {};
    return {
      relationId: r.relationId,
      score: r.score,
      reached: r.evaluation,
      // Le nom n'est jamais transmis qu'en initiale.
      identity: { prenom: s(t.prenom), nom: nomInitial(t.nom) },
    };
  });
}
