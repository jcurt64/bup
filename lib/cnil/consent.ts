/**
 * Critère CNIL strict pour le tracking pixel des emails BUUPP
 * (recommandation n° 2026-042, publiée 14/04/2026).
 *
 * `email_tracking_consent === true` seul NE SUFFIT PAS : la valeur par
 * défaut DB est `true` pendant la période de transition (jusqu'au
 * 14/07/2026 ; cf. lib/cnil/bascule.ts), ce qui ne constitue pas un
 * consentement au sens strict de la CNIL.
 *
 * On exige donc en plus un horodatage `email_tracking_consent_given_at`
 * non-null, qui n'est jamais posé par la DB elle-même mais uniquement
 * par les endpoints PATCH /api/me/email-tracking et opt-out — donc
 * uniquement à la suite d'une **action utilisateur explicite**.
 *
 * À utiliser partout où on décide d'insérer un pixel de tracking dans
 * un email sortant et pour l'affichage du toggle « Suivi des emails »
 * côté UI.
 */
export function hasExplicitEmailTrackingConsent(
  row:
    | {
        email_tracking_consent?: boolean | null;
        email_tracking_consent_given_at?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!row) return false;
  return (
    row.email_tracking_consent === true &&
    row.email_tracking_consent_given_at != null
  );
}
