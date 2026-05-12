import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type FounderContext = {
  isFounder: boolean;
  isWithinBonusWindow: boolean;
  /**
   * Nombre de filleuls du parrain (= du fondateur courant). Toujours
   * borné par le cap waitlist (10). Vaut 0 pour les non-fondateurs et
   * les utilisateurs anonymes.
   */
  filleulCount: number;
  /**
   * True si le fondateur a atteint le plafond de 10 filleuls. C'est la
   * condition côté prospect du palier VIP (la 2ᵉ condition — budget
   * campagne > 300 € — dépend de la campagne et est évaluée à part).
   */
  isVipEligible: boolean;
};

export const VIP_FILLEUL_THRESHOLD = 10;
export const VIP_BUDGET_MIN_CENTS = 30_000; // 300,00 €
export const VIP_FLAT_BONUS_CENTS = 500;    // 5,00 €

/**
 * Lecture du contexte fondateur pour un prospect (ou anonyme).
 *
 * - Si `prospectId` est `null` → user anonyme : `isFounder = false`,
 *   `isWithinBonusWindow` quand même lu pour informer les calculs
 *   d'affichage côté flash deals API.
 * - Sinon : lit `prospects.is_founder` + `is_within_founder_bonus_window()`
 *   + `count_founder_filleuls()` (en parallèle).
 */
export async function getFounderContext(
  admin: SupabaseClient<Database>,
  prospectId: string | null,
): Promise<FounderContext> {
  const { data: winRow } = await admin.rpc("is_within_founder_bonus_window");
  const isWithinBonusWindow = winRow === true;

  if (!prospectId) {
    return {
      isFounder: false,
      isWithinBonusWindow,
      filleulCount: 0,
      isVipEligible: false,
    };
  }

  // Lectures en parallèle : flag fondateur + comptage filleuls.
  const [{ data: prospect }, { data: filleulRow }] = await Promise.all([
    admin
      .from("prospects")
      .select("is_founder")
      .eq("id", prospectId)
      .maybeSingle(),
    admin.rpc("count_founder_filleuls", { p_prospect_id: prospectId }),
  ]);

  const isFounder = prospect?.is_founder === true;
  const filleulCount =
    typeof filleulRow === "number" && Number.isFinite(filleulRow) ? filleulRow : 0;

  return {
    isFounder,
    isWithinBonusWindow,
    filleulCount,
    isVipEligible: isFounder && filleulCount >= VIP_FILLEUL_THRESHOLD,
  };
}
