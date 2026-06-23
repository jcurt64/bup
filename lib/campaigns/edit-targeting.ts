/**
 * Édition restreinte d'une campagne en cours (non clôturée).
 *
 * Le pro ne peut modifier QUE des points qui ÉLARGISSENT la cible (jamais
 * la restreindre) — cf. PATCH /api/pro/campaigns/[id], branche « edit » :
 *   1. lien du site « Vitrine » (si l'option a été souscrite) ;
 *   2. zone géographique (élargir, pas restreindre) ;
 *   3. tranche d'âge (élargir, pas restreindre).
 *
 * Ce module regroupe la logique PURE (pas d'I/O) de validation
 * « élargir-seulement » pour l'âge et la géo, afin qu'elle soit testable
 * en isolation. La résolution réseau du geoTarget (geo.api.gouv.fr) vit
 * dans `lib/geo/france-admin.ts` ; ici on se contente de classer l'intention.
 */

import { AROUND_RADII } from "./mapping";

/* ───────────────────── VÉRIFICATION ───────────────────── */

/** Rang d'exigence de vérification : plus c'est haut, plus le bassin est
 *  étroit. Élargir = exiger un niveau INFÉRIEUR ou égal. */
export const VERIF_RANK: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };

export type VerifWidenResult =
  | { ok: true }
  | { ok: false; error: "verif_not_widening" | "verif_invalid" };

/** Valide qu'on ABAISSE (ou garde) l'exigence de vérification — jamais qu'on
 *  la durcit. Ex. : Vérifié (p1) → Basique (p0) ✓ ; Basique → Vérifié ✗. */
export function classifyVerifWiden(
  currentVerif: string,
  nextVerif: string,
): VerifWidenResult {
  const cur = VERIF_RANK[currentVerif];
  const next = VERIF_RANK[nextVerif];
  if (cur == null || next == null) return { ok: false, error: "verif_invalid" };
  if (next > cur) return { ok: false, error: "verif_not_widening" };
  return { ok: true };
}

/* ───────────────────── FIABILITÉ ───────────────────── */

/** Seuils de fiabilité minimum autorisés (0 = toutes, 60 = bonne, 80 = excellente). */
export const FIABILITE_MIN_LEVELS = [0, 60, 80] as const;

export type FiabiliteWidenResult =
  | { ok: true; value: number }
  | { ok: false; error: "fiabilite_not_widening" | "fiabilite_invalid" };

/** Valide qu'on BAISSE (ou garde) le seuil de fiabilité minimum — jamais qu'on
 *  l'augmente. Ex. : Excellente (80) → Bonne (60) ou Toutes (0) ✓ ; 0 → 60 ✗. */
export function classifyFiabiliteWiden(
  currentMin: number | null | undefined,
  nextMin: number,
): FiabiliteWidenResult {
  if (!(FIABILITE_MIN_LEVELS as readonly number[]).includes(nextMin)) {
    return { ok: false, error: "fiabilite_invalid" };
  }
  const cur = Number(currentMin ?? 0);
  if (nextMin > cur) return { ok: false, error: "fiabilite_not_widening" };
  return { ok: true, value: nextMin };
}

/* ─────────────────────────── ÂGE ─────────────────────────── */

/** Tranches canoniques (miroir de `AGE_RANGES` du wizard, hors « Tous »).
 *  ⚠ tirets demi-cadratin « – » (U+2013), pas des traits d'union. */
export const AGE_BUCKETS = [
  "18–25",
  "26–35",
  "36–45",
  "46–55",
  "56–65",
  "65+",
] as const;

/** Une sélection couvre-t-elle TOUTES les tranches (= aucun filtre d'âge) ?
 *  Vrai si « Tous » est présent, si la liste est vide, ou si les 6 tranches
 *  sont sélectionnées. C'est la borne la plus large possible. */
export function isAllAges(ages: readonly string[]): boolean {
  if (!ages || ages.length === 0) return true;
  if (ages.includes("Tous")) return true;
  return AGE_BUCKETS.every((b) => ages.includes(b));
}

/** Ne conserve que les tranches reconnues, dans l'ordre canonique. */
function cleanAges(ages: readonly string[]): string[] {
  const set = new Set(ages);
  return AGE_BUCKETS.filter((b) => set.has(b));
}

export type AgesWidenResult =
  | { ok: true; ages: string[] }
  | { ok: false; error: "age_not_widening" };

/**
 * Valide que `nextAges` élargit (ou laisse inchangée) `currentAges` — jamais
 * une restriction. Règle : l'ensemble suivant doit être un SUR-ensemble du
 * courant (toutes les tranches actuelles conservées, plus éventuellement
 * d'autres). Passer à « toutes les tranches » est toujours un élargissement.
 *
 * Retourne la liste normalisée à persister (ordre canonique ; « Tous »
 * ajouté quand toutes les tranches sont couvertes, pour rester cohérent
 * avec le wizard et avec `ageRangesToBounds`).
 */
export function validateAgesWiden(
  currentAges: readonly string[],
  nextAges: readonly string[],
): AgesWidenResult {
  const nextAll = isAllAges(nextAges);
  const currentAll = isAllAges(currentAges);

  // Cas « le plus large » demandé → toujours valide (élargit ou égal).
  if (nextAll) {
    return { ok: true, ages: [...AGE_BUCKETS, "Tous"] };
  }

  // Le courant était déjà « toutes tranches » mais on demande plus étroit →
  // restriction interdite.
  if (currentAll) {
    return { ok: false, error: "age_not_widening" };
  }

  const currentSet = new Set(cleanAges(currentAges));
  const nextClean = cleanAges(nextAges);
  const nextSet = new Set(nextClean);

  // Toute tranche actuelle doit rester présente.
  for (const b of currentSet) {
    if (!nextSet.has(b)) return { ok: false, error: "age_not_widening" };
  }
  return { ok: true, ages: nextClean };
}

/* ─────────────────────────── GÉO ─────────────────────────── */

/** Niveaux de zone « fixe » classés du plus étroit au plus large. */
const ZONE_RANK: Record<string, number> = { ville: 1, dept: 2, region: 3 };

/** Directive d'élargissement géo demandée par le client (popup d'édition). */
export type GeoWidenRequest =
  | { mode: "around"; radiusKm: number }
  | { mode: "national" }
  | { mode: "zone"; level: "dept" | "region" };

/** Intention normalisée — ce que le serveur doit appliquer. Pour `zone`,
 *  le geoTarget précis est résolu ensuite via geo.api.gouv.fr. */
export type GeoWidenPlan =
  | { kind: "around"; radiusKm: number }
  | { kind: "national" }
  | { kind: "zone"; level: "dept" | "region" };

export type GeoWidenResult =
  | { ok: true; plan: GeoWidenPlan }
  | { ok: false; error: "geo_not_widening" | "geo_invalid" };

/**
 * Classe une demande d'élargissement géo en vérifiant qu'elle ÉLARGIT
 * strictement la portée courante. Mécanismes distincts (jamais mélangés) :
 *
 *  - « autour de moi » (`around`) → seul un rayon STRICTEMENT plus grand
 *    parmi {10,30,50} est accepté, ou bien le passage au National.
 *  - zones fixes (`ville` < `dept` < `region`) → seul un niveau de rang
 *    supérieur est accepté, ou bien le National.
 *  - `national` est la portée maximale : disponible depuis n'importe quelle
 *    zone (sauf si déjà nationale), jamais réductible.
 *
 * On ne mélange pas « around » et zones fixes (filtres incompatibles) : pour
 * basculer de l'un à l'autre, seul le National (universel) est proposé.
 */
export function classifyGeoWiden(
  currentGeo: string,
  currentRadiusKm: number | null | undefined,
  req: GeoWidenRequest,
): GeoWidenResult {
  if (!req || typeof req !== "object") {
    return { ok: false, error: "geo_invalid" };
  }

  if (req.mode === "national") {
    if (currentGeo === "national") {
      return { ok: false, error: "geo_not_widening" };
    }
    return { ok: true, plan: { kind: "national" } };
  }

  if (req.mode === "around") {
    if (currentGeo !== "around") return { ok: false, error: "geo_invalid" };
    const r = Number(req.radiusKm);
    if (!(AROUND_RADII as readonly number[]).includes(r)) {
      return { ok: false, error: "geo_invalid" };
    }
    const cur = Number(currentRadiusKm ?? 0);
    if (r <= cur) return { ok: false, error: "geo_not_widening" };
    return { ok: true, plan: { kind: "around", radiusKm: r } };
  }

  if (req.mode === "zone") {
    const target = req.level;
    if (target !== "dept" && target !== "region") {
      return { ok: false, error: "geo_invalid" };
    }
    const curRank = ZONE_RANK[currentGeo];
    if (!curRank) {
      // « around » ou « national » → pas d'escalade vers une zone fixe.
      return { ok: false, error: "geo_invalid" };
    }
    if (ZONE_RANK[target] <= curRank) {
      return { ok: false, error: "geo_not_widening" };
    }
    return { ok: true, plan: { kind: "zone", level: target } };
  }

  return { ok: false, error: "geo_invalid" };
}

/** Options d'élargissement géo proposables dans la popup, selon la portée
 *  courante. Sert au front pour n'afficher QUE des élargissements valides
 *  (et au serveur, comme documentation de la matrice autorisée). */
export function availableGeoWidenOptions(
  currentGeo: string,
  currentRadiusKm: number | null | undefined,
): GeoWidenRequest[] {
  const out: GeoWidenRequest[] = [];
  if (currentGeo === "around") {
    const cur = Number(currentRadiusKm ?? 0);
    for (const r of AROUND_RADII) {
      if (r > cur) out.push({ mode: "around", radiusKm: r });
    }
    out.push({ mode: "national" });
    return out;
  }
  const curRank = ZONE_RANK[currentGeo];
  if (curRank) {
    if (curRank < ZONE_RANK.dept) out.push({ mode: "zone", level: "dept" });
    if (curRank < ZONE_RANK.region) out.push({ mode: "zone", level: "region" });
    out.push({ mode: "national" });
    return out;
  }
  // national → rien à élargir.
  return out;
}
