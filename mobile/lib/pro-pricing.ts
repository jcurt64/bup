// Modèle de rémunération des campagnes — miroir EXACT de la validation
// backend (app/api/pro/campaigns/route.ts + lib/prospect/tier-rewards.ts).
// Permet au wizard mobile de calculer un costPerContactCents toujours valide.

export type TierNum = 1 | 2 | 3 | 4 | 5;

export const TIER_REWARDS: Record<TierNum, { minCents: number; maxCents: number; label: string }> = {
  1: { minCents: 100, maxCents: 100, label: "Identification" },
  2: { minCents: 100, maxCents: 200, label: "Localisation" },
  3: { minCents: 200, maxCents: 350, label: "Style de vie" },
  4: { minCents: 350, maxCents: 500, label: "Données pro" },
  5: { minCents: 500, maxCents: 1000, label: "Patrimoine" },
};

export type DurationKey = "1h" | "24h" | "48h" | "7d";
export const DURATIONS: { key: DurationKey; label: string; mult: number; ms: number }[] = [
  { key: "1h", label: "1 heure", mult: 3, ms: 3600_000 },
  { key: "24h", label: "24 heures", mult: 2, ms: 24 * 3600_000 },
  { key: "48h", label: "48 heures", mult: 1.5, ms: 48 * 3600_000 },
  { key: "7d", label: "7 jours", mult: 1, ms: 7 * 24 * 3600_000 },
];

export type VerifLevel = "p0" | "p1" | "p2";
export const VERIF_LEVELS: { key: VerifLevel; label: string; mult: number }[] = [
  { key: "p0", label: "Tous", mult: 1 },
  { key: "p1", label: "Vérifiés", mult: 1.5 },
  { key: "p2", label: "Certifiés", mult: 2 },
];

export const GEO_ZONES: { key: string; label: string; sub: string }[] = [
  { key: "ville", label: "Ville", sub: "rayon ~20 km" },
  { key: "dept", label: "Département", sub: "rayon ~50 km" },
  { key: "region", label: "Région", sub: "rayon ~150 km" },
  { key: "national", label: "National", sub: "toute la France" },
];

function durMult(key: DurationKey) {
  return DURATIONS.find((d) => d.key === key)?.mult ?? 1;
}
export function durMs(key: DurationKey) {
  return DURATIONS.find((d) => d.key === key)?.ms ?? 7 * 24 * 3600_000;
}
function verifMult(key: VerifLevel) {
  return VERIF_LEVELS.find((v) => v.key === key)?.mult ?? 1;
}

/** Fourchette de coût par contact (cents) autorisée — miroir backend. */
export function cpcRange(
  tiers: number[],
  duration: DurationKey,
  verif: VerifLevel,
): { effMin: number; effMax: number } {
  const valid = tiers.filter((t): t is TierNum => t >= 1 && t <= 5);
  if (valid.length === 0) return { effMin: 0, effMax: 0 };
  const maxTier = Math.max(...valid) as TierNum;
  const dm = durMult(duration);
  const effMin = Math.round(TIER_REWARDS[maxTier].minCents * dm);
  const midpointSum = valid.reduce((sum, t) => {
    const r = TIER_REWARDS[t];
    return sum + (r.minCents + r.maxCents) / 2;
  }, 0);
  const effMax = Math.round(midpointSum * verifMult(verif) * dm) + 2;
  return { effMin, effMax };
}
