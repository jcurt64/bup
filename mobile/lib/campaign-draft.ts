// Brouillon de campagne persisté (équivalent mobile du sessionStorage du
// wizard web) : on sauvegarde la saisie à chaque étape pour la restaurer
// quand le pro quitte puis revient sur « Créer une campagne ».
import * as SecureStore from "expo-secure-store";

const KEY = "buupp.campaign.draft.v1";

export type CampaignDraft = {
  objectiveId: string;
  step: number;
  subTypes: string[];
  duration: string;
  tiers: number[];
  geo: string;
  ages: string[];
  verif: string;
  minFiab: number;
  excludeCertified: boolean;
  cpcCents: number;
  contacts: string;
  /** Liste de mots-clés (puces). Les anciens brouillons stockaient une
   *  chaîne « a, b, c » — toujours relue par le wizard. */
  keywords: string[] | string;
  kwFilter: boolean;
  brief: string;
  // Champs ajoutés pour la parité web (optionnels : brouillons antérieurs).
  geoTarget?: unknown;
  radiusKm?: number;
  /** Jour de lancement « AAAA-MM-JJ » (heure locale). */
  startDay?: string;
  poolMode?: string;
  founderBonusEnabled?: boolean;
  vitrineUrl?: string;
  vitrineAdded?: boolean;
  vitrineModalSeen?: boolean;
  updatedAt: number;
};

export async function saveDraft(d: CampaignDraft): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(d));
  } catch {
    /* best-effort */
  }
}

export async function loadDraft(): Promise<CampaignDraft | null> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    if (!v) return null;
    const d = JSON.parse(v) as CampaignDraft;
    return d && typeof d.objectiveId === "string" ? d : null;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* best-effort */
  }
}
