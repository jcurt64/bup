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

// Tranches d'âge (multi-sélection) — identiques au wizard web.
export const AGE_RANGES = ["18–25", "26–35", "36–45", "46–55", "56–65", "65+", "Tous"];
export const AGE_RANGES_NO_TOUS = AGE_RANGES.filter((a) => a !== "Tous");

export const GEO_ZONES: { key: string; label: string; sub: string }[] = [
  { key: "ville", label: "Ville", sub: "rayon ~20 km" },
  { key: "dept", label: "Département", sub: "rayon ~50 km" },
  { key: "region", label: "Région", sub: "rayon ~150 km" },
  { key: "national", label: "National", sub: "toute la France" },
];
// NB : « Autour de moi » (`around`) est proposé à part dans le wizard (bouton
// dédié sous ces 4 portées, comme le web) — cf. AROUND_RADII ci-dessous.

// Description courte de chaque palier (étape 3) — miroir de TIERS_DATA web.
export const TIER_SUBS: Record<TierNum, string> = {
  1: "Email, nom, téléphone, date de naissance",
  2: "Adresse postale, logement, mobilité",
  3: "Habitudes, famille, véhicule, sport",
  4: "Statut, secteur",
  5: "Immobilier, projets",
};

// Ciblage « Autour de moi » (geo = "around") : rayon autour de l'adresse de
// l'établissement, borné à 10/30/50 km (normalizeRadiusKm côté serveur).
// Aucun impact tarifaire : le coût par contact ne dépend que des paliers,
// de la vérification et de la durée (identique au web).
export const AROUND_RADII = [10, 30, 50] as const;
export type AroundRadius = (typeof AROUND_RADII)[number];

// Cible géographique précise (autocomplete geo.api.gouv.fr) — même forme que
// le `geoTarget` envoyé par le wizard web (normalizeGeoTarget côté serveur).
export type GeoTarget =
  | {
      type: "ville";
      nom: string;
      code: string;
      codesPostaux: string[];
      codeDepartement: string | null;
      codeRegion: string | null;
    }
  | { type: "dept"; nom: string; code: string; codeRegion: string | null }
  | { type: "region"; nom: string; code: string; deptCodes: string[] };

/** Libellé de zone pour le récapitulatif (miroir du récap web). */
export function geoSummary(geo: string, target: GeoTarget | null, radiusKm: number): string {
  if (geo === "around") return `Autour de moi · ${radiusKm} km`;
  const base = GEO_ZONES.find((z) => z.key === geo)?.label ?? geo;
  if (!target) return base;
  if (target.type === "ville") {
    const cp = target.codesPostaux[0];
    return `${base} · ${target.nom}${cp ? ` (${cp})` : ""}`;
  }
  if (target.type === "dept") return `${base} · ${target.nom} (${target.code})`;
  return `${base} · ${target.nom}`;
}

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
