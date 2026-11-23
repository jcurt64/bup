/**
 * Comptes de TEST (pro et prospect fictifs) — cloisonnés des vrais comptes.
 *
 * Colonne `is_test` sur `prospects` et `pro_accounts` (migration
 * 20261123120000). Règle de cloisonnement :
 *   • une campagne / étude d'un pro de test ne sollicite / notifie QUE des
 *     prospects de test ;
 *   • un vrai pro ne sollicite JAMAIS un prospect de test ;
 *   • les annonces publiques (flash deals, Tests & Études) d'un pro de test
 *     ne sont visibles que par les comptes de test.
 *
 * Marquage automatique à la création du compte quand l'e-mail utilise le
 * sous-adressage de test Clerk (`…+clerk_test@…`, code OTP 424242 en dev).
 * Un compte peut aussi être marqué à la main (`update … set is_test = true`).
 */

/** `prenom+clerk_test@domaine`, `x+clerk_test2@…`, `x+test@…`. */
const TEST_EMAIL = /\+(clerk_)?test\d*@/i;

export function isTestEmail(email: string | null | undefined): boolean {
  return !!email && TEST_EMAIL.test(email.trim());
}
