/**
 * Complétude du profil contact prospect.
 *
 * Pivot « mise en relation pure » : plus de paliers de données. Pour
 * ACCEPTER une sollicitation, le prospect doit avoir renseigné ses 7
 * données : prénom, initiale du nom, ville, sexe, tranche d'âge, e-mail et
 * téléphone. (Pour le matching, ville / sexe / tranche d'âge ne sont requis
 * que si la campagne filtre dessus.) Appliqué côté
 * serveur dans `POST /api/prospect/relations/[id]/decision` (action `accept`).
 */

import {
  ACCEPT_REQUIRED_FIELDS,
  CONTACT_FIELDS,
  isContactProfileComplete,
  missingContactFields,
  type ContactIdentity,
} from "@/lib/campaigns/contact-channels";

export { ACCEPT_REQUIRED_FIELDS, CONTACT_FIELDS, isContactProfileComplete, missingContactFields };
export type { ContactIdentity };

/** Compat : colonnes requises (seul le palier identity subsiste). */
export const REQUIRED_TIER_FIELDS = { identity: [...ACCEPT_REQUIRED_FIELDS] } as const;

/** Numéros de paliers « manquants » au sens historique : [1] si le profil
 *  contact est incomplet, [] sinon (rétro-compat du champ `missingTiers`). */
export function missingTierNumsForIdentity(
  identity: ContactIdentity | null | undefined,
): number[] {
  return isContactProfileComplete(identity) ? [] : [1];
}
