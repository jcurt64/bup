/**
 * Formule unique BUUPP (depuis novembre 2026) : aucun frais d'accès,
 * campagnes illimitées, 5 paliers ouverts, commission par acceptation.
 *
 * Forme compatible avec l'ancien `PlanSpec` (Starter/Pro) pour que les builds
 * mobiles déjà publiés continuent de fonctionner sans afficher de frais.
 */
import {
  COMMISSION_FLOOR_CENTS,
  COMMISSION_LABEL,
  COMMISSION_RATE_BP,
} from "@/lib/pricing/commission";

/** Nombre max de contacts par campagne (borne du curseur du wizard). */
export const MAX_PROSPECTS_PER_CAMPAIGN = 500;
/** Valeur « illimitée » exposée aux anciens clients qui lisent maxCampaigns. */
export const UNLIMITED_CAMPAIGNS = 9999;

export function singlePlanPayload() {
  return {
    label: "Formule unique",
    monthlyEur: 0,
    monthlyCents: 0,
    maxProspects: MAX_PROSPECTS_PER_CAMPAIGN,
    maxCampaigns: UNLIMITED_CAMPAIGNS,
    commission: {
      rateBp: COMMISSION_RATE_BP,
      floorCents: COMMISSION_FLOOR_CENTS,
      label: COMMISSION_LABEL,
    },
  };
}
