// Version web de lib/tracking : pas d'App Tracking Transparency sur web
// (et pas de module natif) — rien à demander ni à transmettre.
export const TRACKING_OBJECTIVE_ID = "addigital";

export async function resolveTrackingAuthorization(
  _prompt: boolean,
): Promise<boolean | undefined> {
  return undefined;
}
