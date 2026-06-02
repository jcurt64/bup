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
  verif: string;
  excludeCertified: boolean;
  cpcCents: number;
  contacts: string;
  keywords: string;
  kwFilter: boolean;
  brief: string;
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
