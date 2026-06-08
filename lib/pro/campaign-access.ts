/**
 * Règle d'accès pro aux données par prospect : le pro ne voit les contacts
 * (liste, noms, révélation, détails) d'une campagne qu'une fois celle-ci
 * CLÔTURÉE (status='completed'). Avant clôture, seuls les compteurs sont
 * exposés. Cf. spec 2026-06-08-escrow-until-closure-pro-gating.
 */
export function proCanSeeContacts(
  campaignStatus: string | null | undefined,
): boolean {
  return campaignStatus === "completed";
}
