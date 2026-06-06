/**
 * Contrat d'affichage des transactions prospect, partagé par
 * /api/prospect/wallet (agrégats de gains) et /api/prospect/movements
 * (libellés de l'historique). Centralisé ici pour rester DRY et testable.
 */

/** Types de transaction comptés comme "gain" du prospect (mois + cumul +
 *  disponible). `signup_bonus` = bonus fondateur 5 € crédité à l'inscription,
 *  pleinement retirable au même titre qu'un credit/referral_bonus. */
export const GAIN_TRANSACTION_TYPES = [
  "credit",
  "referral_bonus",
  "signup_bonus",
] as const;

/** Libellé d'origine canonique d'une ligne de bonus fondateur dans
 *  l'historique des mouvements (transaction hors-relation). */
export const SIGNUP_BONUS_ORIGIN = "Bonus fondateur 🎁";

export function statusLabel(type: string, status: string): string {
  if (type === "withdrawal") return status === "completed" ? "Exécuté" : "En cours";
  if (type === "escrow")
    return status === "pending" ? "En séquestre"
      : status === "completed" ? "Crédité"
      : status === "canceled" ? "Annulé" : status;
  if (type === "credit") return status === "completed" ? "Crédité" : status;
  if (type === "referral_bonus") return status === "completed" ? "Crédité" : status;
  if (type === "signup_bonus") return status === "completed" ? "Crédité" : status;
  if (type === "refund") return "Remboursé";
  return status;
}

// `chip-good` (vert), `chip-warn` (orange), ou "" (neutre) — aligné avec les
// classes CSS de la table de l'onglet Portefeuille.
export function statusChip(type: string, status: string): "good" | "warn" | "" {
  if (type === "escrow" && status === "pending") return "warn";
  if (
    (type === "credit" || type === "referral_bonus" || type === "signup_bonus") &&
    status === "completed"
  ) {
    return "good";
  }
  if (type === "escrow" && status === "completed") return "good";
  return "";
}
