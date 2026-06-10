/** Frais forfaitaire d'un FREEBUUPP : 10 € (décidé côté serveur). */
export const FREEBUUPP_FEE_CENTS = 1000;

/** Remboursement uniquement si aucun prospect ne s'est inscrit. */
export function shouldRefund(participantCount: number): boolean {
  return participantCount === 0;
}
