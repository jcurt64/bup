import crypto from "node:crypto";

/** Alphabet sans caractères ambigus (pas de I, O, 0, 1). Même alphabet côté SQL. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateParticipationCode(): string {
  const bytes = crypto.randomBytes(4);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `BU-${out}`;
}
