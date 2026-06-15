/**
 * Agrégat « taux de lecture » des messages pro→prospect.
 *
 * Logique pure et testable, isolée de l'I/O. Alimentée par les lignes
 * `pro_contact_actions` (`kind='email_sent'`) d'un pro : chaque envoi porte
 * un `tracking_token` et, à la première ouverture du pixel 1×1, un
 * `email_opened_at`.
 *
 * Honnêteté du dénominateur : le pixel n'est inséré QUE chez les prospects
 * ayant explicitement consenti (CNIL). Compter les envois non traçables au
 * dénominateur ferait artificiellement chuter le taux (ils ne peuvent jamais
 * être « ouverts »). Le taux se calcule donc sur les seuls envois
 * **traçables**.
 *
 * Un envoi est traçable s'il portait un pixel : `trackingPixelEmbedded === true`
 * (posé à l'envoi selon le consentement réel), OU s'il a été ouvert
 * (`emailOpenedAt != null` — une ouverture prouve la présence d'un pixel, ce
 * qui couvre l'historique antérieur à la colonne sans dépendre du backfill).
 * Cette définition garantit `opened ⊆ trackable`.
 */

export type MessageActionRow = {
  /** Timestamp de la première ouverture (null si jamais ouvert / non traçable). */
  emailOpenedAt: string | null;
  /** Pixel inséré à l'envoi (consentement réel) ; null = historique inconnu. */
  trackingPixelEmbedded: boolean | null;
};

export type MessageOpenStats = {
  /** Nombre total de messages envoyés (toutes traçabilités confondues). */
  sent: number;
  /** Messages réellement traçables (pixel posé). Dénominateur du taux. */
  trackable: number;
  /** Messages ouverts (forcément traçables). */
  opened: number;
  /** Taux de lecture en % (opened / trackable), ou null si aucun traçable. */
  rate: number | null;
};

export function computeMessageOpenStats(
  rows: ReadonlyArray<MessageActionRow>,
): MessageOpenStats {
  let trackable = 0;
  let opened = 0;
  for (const r of rows) {
    const isOpened = r.emailOpenedAt != null;
    if (isOpened) opened++;
    if (r.trackingPixelEmbedded === true || isOpened) trackable++;
  }
  return {
    sent: rows.length,
    trackable,
    opened,
    rate: trackable > 0 ? Math.round((opened / trackable) * 100) : null,
  };
}
