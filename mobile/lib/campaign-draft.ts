// Brouillon de campagne persisté (équivalent mobile du sessionStorage du
// wizard web) : on sauvegarde la saisie à chaque étape pour la restaurer
// quand le pro quitte puis revient sur « Créer une campagne ».
import * as SecureStore from "expo-secure-store";

// v2 : pivot mise en relation (modes de contact, plus de paliers) ; ciblage
// villes/sexe/âge ajouté en champs optionnels (anciens brouillons = tous).
const KEY = "buupp.campaign.draft.v2";

export type CampaignDraft = {
  objectiveId: string;
  step: number;
  subTypes: string[];
  duration: string;
  /** Modes de contact cochés par le pro (téléphone / e-mail). */
  contactChannels: ("phone" | "email")[];
  verif: string;
  minFiab: number;
  excludeCertified: boolean;
  cpcCents: number;
  contacts: string;
  /** Domaines d'activité (≤ 2, [] = Tous). Absent des anciens brouillons. */
  domains?: string[];
  /** Hérités (mots-clés retirés) — ignorés à la relecture. */
  keywords?: string[] | string;
  kwFilter?: boolean;
  brief: string;
  // Champs ajoutés pour la parité web (optionnels : brouillons antérieurs).
  /** Jour de lancement « AAAA-MM-JJ » (heure locale). */
  startDay?: string;
  poolMode?: string;
  vitrineUrl?: string;
  vitrineAdded?: boolean;
  vitrineModalSeen?: boolean;
  /** « Exclure les prospects ayant déjà accepté une de mes campagnes ». */
  excludePastAcceptors?: boolean;
  /** Le pro a modifié l'option lui-même (sinon défaut selon l'objectif). */
  excludePastAcceptorsTouched?: boolean;
  /** Ciblage villes / sexe / tranche d'âge (absents des anciens brouillons
   *  → vides = tous). */
  targetCities?: string[];
  targetGenres?: string[];
  targetAgeBands?: string[];
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
