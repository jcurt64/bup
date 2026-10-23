// App Tracking Transparency (iOS). Les campagnes « Publicité digitale »
// (objectif `addigital`) permettent au pro de constituer des audiences
// publicitaires (Meta, Google…) avec les coordonnées du prospect : au sens
// d'Apple, c'est du « suivi ». Sur iOS, accepter une telle campagne exige
// donc l'autorisation ATT ; le serveur le vérifie aussi (403
// tracking_not_authorized si platform=ios et trackingAuthorized !== true).
//
// Version native — la version web (tracking.web.ts) est un no-op : le module
// natif n'existe pas sur web (requireNativeModule lèverait à l'import).
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";
import { Platform } from "react-native";

/** Objectif de campagne assimilé à du suivi publicitaire au sens d'Apple. */
export const TRACKING_OBJECTIVE_ID = "addigital";

/**
 * Statut d'autorisation de suivi à transmettre au serveur.
 * - Hors iOS : `undefined` (rien à envoyer, ATT n'existe pas).
 * - iOS : `true` si autorisé. Si `prompt` et que le système peut encore
 *   demander, affiche la demande ATT ; sinon renvoie le statut courant.
 */
export async function resolveTrackingAuthorization(
  prompt: boolean,
): Promise<boolean | undefined> {
  if (Platform.OS !== "ios") return undefined;
  try {
    const current = await getTrackingPermissionsAsync();
    if (current.granted) return true;
    if (!prompt || !current.canAskAgain) return false;
    const asked = await requestTrackingPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}
