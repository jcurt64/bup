/** Projection d'une participation pour le pro : liste blanche stricte (spec §7). */
export type ProParticipant = {
  id: string;
  prenom: string | null;
  alias: string | null;
  code: string | null;
  status: string;
  doneComment: string | null;
  doneAt: string | null;
  reviewDueAt: string | null;
};

export function toProParticipant(row: {
  id: string;
  status: string;
  code?: string | null;
  done_comment?: string | null;
  done_at?: string | null;
  review_due_at?: string | null;
  prenom?: string | null;
  alias?: string | null;
  [k: string]: unknown;
}): ProParticipant {
  return {
    id: row.id,
    prenom: row.prenom ?? null,
    alias: row.alias ?? null,
    code: row.code ?? null,
    status: row.status,
    doneComment: row.done_comment ?? null,
    doneAt: row.done_at ?? null,
    reviewDueAt: row.review_due_at ?? null,
  };
}
