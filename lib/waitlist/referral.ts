export type ReferralBadgeTier = "cuivre" | "argent" | "or";

/**
 * Palier de badge couronne selon le nombre de filleuls.
 *   0      → null (pas de badge)
 *   1-2    → cuivre
 *   3-9    → argent
 *   10+    → or
 * (10 = cap waitlist ; >10 impossible via le trigger Postgres, mais on
 *  borne quand même pour robustesse d'affichage.)
 */
export function referralBadgeTier(count: number): ReferralBadgeTier | null {
  if (count >= 10) return "or";
  if (count >= 3) return "argent";
  if (count >= 1) return "cuivre";
  return null;
}
