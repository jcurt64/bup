/**
 * Édition restreinte d'une campagne en cours (non clôturée).
 *
 * Le pro ne peut modifier QUE des points qui ÉLARGISSENT la cible (jamais
 * la restreindre) — cf. PATCH /api/pro/campaigns/[id], branche « edit » :
 * lien Vitrine, vérification, fiabilité, exclusion des anciens acceptants,
 * filtres d'audience villes / sexe / tranche d'âge (garde dans
 * audience-targeting.ts → classifyAudienceWiden).
 *
 * Pivot « mise en relation pure » : l'ancienne zone géographique (rayon /
 * département / région) et les anciennes tranches d'âge détaillées n'existent
 * plus — le PATCH accepte et ignore les champs `geo` / `ages` historiques.
 */

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

/* ──────────── EXCLUSION DES ANCIENS ACCEPTANTS ──────────── */

export type ExcludePastAcceptorsWidenResult =
  | { ok: true; value: boolean }
  | { ok: false; error: "exclude_past_acceptors_not_widening" | "exclude_past_acceptors_invalid" };

/** L'option « exclure les prospects ayant déjà accepté une de mes campagnes »
 *  RESTREINT la cible : on peut la DÉSACTIVER en cours de campagne (élargir),
 *  jamais l'activer. true → false ✓ ; false → false ✓ (no-op) ; false → true ✗. */
export function classifyExcludePastAcceptorsWiden(
  current: boolean | null | undefined,
  next: unknown,
): ExcludePastAcceptorsWidenResult {
  if (typeof next !== "boolean") return { ok: false, error: "exclude_past_acceptors_invalid" };
  if (next && current !== true) {
    return { ok: false, error: "exclude_past_acceptors_not_widening" };
  }
  return { ok: true, value: next };
}
