// Modèle de rémunération des campagnes — miroir EXACT de la validation
// backend (app/api/pro/campaigns/route.ts).
// Permet au wizard mobile de calculer un costPerContactCents toujours valide.

// Pivot « mise en relation pure » : plus de paliers de données. La
// rémunération de base d'une mise en relation est fixe (1,00 €), multipliée
// par la durée (1h ×3, 24h ×2, 48h ×1.5, 7j ×1) et le niveau de vérification.
export const BASE_REWARD_CENTS = 100;

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

// Mots-clés proposés en un tap (étape 6) — identiques au web.
export const KW_SUGGESTIONS = [
  "véhicule",
  "immobilier",
  "retraite",
  "sport",
  "artisan",
  "nutrition",
  "coaching",
  "BTP",
  "épargne",
  "assurance",
  "crédit",
  "jardinage",
  "animaux",
  "voyages",
  "informatique",
];

// Brief affiché au prospect (« Le mot du professionnel ») — 50 car. max (web).
export const BRIEF_MAX_LENGTH = 50;

function durMult(key: DurationKey) {
  return DURATIONS.find((d) => d.key === key)?.mult ?? 1;
}
export function durMs(key: DurationKey) {
  return DURATIONS.find((d) => d.key === key)?.ms ?? 7 * 24 * 3600_000;
}
function verifMult(key: VerifLevel) {
  return VERIF_LEVELS.find((v) => v.key === key)?.mult ?? 1;
}

/** Fourchette de coût par contact (cents) autorisée — miroir backend
 *  (base 1,00 € × durée ; plafond = base × vérification × durée). */
export function cpcRange(
  duration: DurationKey,
  verif: VerifLevel,
): { effMin: number; effMax: number } {
  const dm = durMult(duration);
  const effMin = Math.round(BASE_REWARD_CENTS * dm);
  const effMax = Math.round(BASE_REWARD_CENTS * verifMult(verif) * dm) + 2;
  return { effMin, effMax };
}
