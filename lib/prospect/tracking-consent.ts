/**
 * Garde ATT (App Tracking Transparency, Apple) pour les campagnes
 * « Publicité digitale » (objectiveId `addigital`).
 *
 * Sur ce type de campagne, le pro construit des audiences publicitaires
 * (Meta, Google, TikTok…) à partir des données du prospect — ce qu'Apple
 * qualifie de « suivi ». L'app iOS demande donc l'autorisation ATT au
 * moment de l'acceptation et transmet le résultat à la route de décision.
 * Le web n'envoie jamais `platform: "ios"` : son comportement est inchangé.
 */

export const TRACKING_OBJECTIVE_ID = "addigital";

export type DecisionPlatform = "ios" | "android" | "web";

export const TRACKING_NOT_AUTHORIZED_MESSAGE =
  "Cette campagne de publicité digitale nécessite votre autorisation de suivi. Activez-la dans Réglages › Confidentialité et sécurité › Suivi, puis réessayez.";

/** Lit `targeting.objectiveId` de façon défensive (JSON libre en base). */
export function objectiveIdOf(
  targeting: Record<string, unknown> | null | undefined,
): string | null {
  const v = targeting?.objectiveId;
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** Normalise le champ `platform` du body (toute autre valeur → null). */
export function parseDecisionPlatform(v: unknown): DecisionPlatform | null {
  return v === "ios" || v === "android" || v === "web" ? v : null;
}

/**
 * true si l'acceptation doit être refusée faute d'autorisation de suivi :
 * campagne « Publicité digitale » + app iOS + ATT non accordée.
 */
export function requiresTrackingConsent(
  objectiveId: string | null | undefined,
  platform: DecisionPlatform | null | undefined,
  trackingAuthorized: boolean | null | undefined,
): boolean {
  return (
    objectiveId === TRACKING_OBJECTIVE_ID &&
    platform === "ios" &&
    trackingAuthorized !== true
  );
}
