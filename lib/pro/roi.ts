/**
 * Calcul du "ROI estimé" affiché sur la Vue d'ensemble pro.
 *
 * Formule (vraie définition du ROI marketing) :
 *
 *     ROI % = (gains_potentiels − coût_réel) / coût_réel × 100
 *
 * où :
 *   - coût_réel       = somme `reward_cents` des relations gagnées sur 30j
 *                       (ce que le pro a effectivement payé pour acquérir
 *                       ces contacts).
 *   - gains_potentiels = nbContactsAcceptés30j × tauxConversion × valeurClient
 *                       (estimation du chiffre généré si la fraction
 *                       attendue de contacts se convertit en clients).
 *
 * Les hypothèses (taux de conversion + valeur client moyenne) sont fixées
 * ici par des constantes partagées. Elles sont volontairement exposées au
 * pro dans le tooltip de la carte pour qu'il puisse interpréter la valeur
 * (et ajuster mentalement à son métier). Si plus tard on souhaite que le
 * pro saisisse ses propres valeurs, ces constantes deviendront des
 * colonnes sur `pro_accounts` (`valeur_client_moyenne_cents`,
 * `taux_conversion_pct`).
 *
 * Choix des défauts :
 *   - tauxConversion = 10 %  → un contact accepté sur dix devient client.
 *     Médian inter-secteurs (B2C local : 5-15 %, e-commerce : 1-3 %,
 *     services : 10-25 %).
 *   - valeurClient   = 100 €  → panier moyen générique. Suffisamment bas
 *     pour ne pas survendre, suffisamment haut pour rester crédible.
 */

export const ROI_ASSUMED_CONVERSION_PCT = 10;
export const ROI_ASSUMED_VALUE_PER_CLIENT_CENTS = 10_000; // 100,00 €

export type RoiSnapshot = {
  /** Pourcentage de ROI arrondi à l'entier. Null si dépense nulle. */
  pct: number | null;
  /** Dépense réelle sur les 30 derniers jours (en centimes). */
  spentCents: number;
  /** Gains potentiels estimés sur les 30 derniers jours (en centimes). */
  potentialRevenueCents: number;
  /** Hypothèses appliquées, renvoyées pour transparence côté UI. */
  assumedConversionPct: number;
  assumedValuePerClientCents: number;
};

/**
 * Calcule le ROI 30j à partir des montants déjà connus côté serveur.
 * Renvoie `pct = null` quand le pro n'a rien dépensé (division par zéro
 * non significative — l'UI affichera "—").
 */
export function computeRoi(
  spentCents: number,
  acceptedCount: number,
): RoiSnapshot {
  const potentialRevenueCents = Math.round(
    acceptedCount *
      (ROI_ASSUMED_CONVERSION_PCT / 100) *
      ROI_ASSUMED_VALUE_PER_CLIENT_CENTS,
  );
  const pct =
    spentCents > 0
      ? Math.round(
          ((potentialRevenueCents - spentCents) / spentCents) * 100,
        )
      : null;
  return {
    pct,
    spentCents,
    potentialRevenueCents,
    assumedConversionPct: ROI_ASSUMED_CONVERSION_PCT,
    assumedValuePerClientCents: ROI_ASSUMED_VALUE_PER_CLIENT_CENTS,
  };
}
