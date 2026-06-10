import { createHash, randomBytes } from "node:crypto";
import type { DrawResult } from "./types";

/** Graine aléatoire 32 octets hex — générée à la CRÉATION du freebuupp. */
export function generateSeed(): string {
  return randomBytes(32).toString("hex");
}

export function hashSeed(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

/** Score déterministe d'un participant pour un seed donné. */
function score(seed: string, participantNumber: number): string {
  return createHash("sha256").update(`${seed}:${participantNumber}`).digest("hex");
}

/**
 * Tirage vérifiable : on ordonne les participants par sha256(seed:numéro)
 * et on prend les `min(winnersCount, participants.length)` premiers.
 * Pas de Math.random — entièrement reproductible à partir du seed.
 */
export function drawWinners(opts: {
  seed: string;
  participants: number[];
  winnersCount: number;
}): DrawResult {
  const { seed, participants, winnersCount } = opts;
  const ordered = [...participants].sort((a, b) => {
    const sa = score(seed, a);
    const sb = score(seed, b);
    return sa < sb ? -1 : sa > sb ? 1 : a - b;
  });
  const take = Math.max(0, Math.min(winnersCount, participants.length));
  return { winners: ordered.slice(0, take), seed, seedHash: hashSeed(seed) };
}

/** Rejoue le tirage et compare — utilisé par l'API publique de vérification. */
export function verifyDraw(opts: {
  seed: string;
  seedHash: string;
  participants: number[];
  winnersCount: number;
  claimedWinners: number[];
}): boolean {
  if (hashSeed(opts.seed) !== opts.seedHash) return false;
  const recomputed = drawWinners({
    seed: opts.seed,
    participants: opts.participants,
    winnersCount: opts.winnersCount,
  }).winners;
  if (recomputed.length !== opts.claimedWinners.length) return false;
  return recomputed.every((w, i) => w === opts.claimedWinners[i]);
}
