// Domaine FREEBUUPP — types partagés (DTO API + logique métier).

export type FreebuuppStatus = "open" | "closed" | "drawn" | "canceled";
export type PanelSize = 30 | 50 | 80;
export type WinnersCount = 2 | 5 | 10;

export const PANEL_SIZES: PanelSize[] = [30, 50, 80];
export const WINNERS_COUNTS: WinnersCount[] = [2, 5, 10];

export type GeoTarget =
  | { type: "ville"; nom: string; code: string; codesPostaux: string[] }
  | { type: "dept"; nom: string; code: string }
  | { type: "region"; nom: string; code: string; deptCodes: string[] }
  | null;

/** Participant tel que figé pour le tirage : seul le numéro compte. */
export interface DrawParticipant {
  participantNumber: number;
}

/** Résultat d'un tirage vérifiable. */
export interface DrawResult {
  winners: number[]; // participant_number des gagnants, ordre du tirage
  seed: string;
  seedHash: string;
}
