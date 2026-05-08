import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type FounderContext = {
  isFounder: boolean;
  isWithinBonusWindow: boolean;
};

/**
 * Lecture du contexte fondateur pour un prospect (ou anonyme).
 *
 * - Si `prospectId` est `null` → user anonyme : `isFounder = false`,
 *   `isWithinBonusWindow` quand même lu pour informer les calculs
 *   d'affichage côté flash deals API.
 * - Sinon : lit `prospects.is_founder` + `is_within_founder_bonus_window()`.
 */
export async function getFounderContext(
  admin: SupabaseClient<Database>,
  prospectId: string | null,
): Promise<FounderContext> {
  // Toujours lire la fenêtre (sert aussi pour décider si l'affichage
  // doublé doit être tenté côté UI).
  const { data: winRow } = await admin.rpc("is_within_founder_bonus_window");
  const isWithinBonusWindow = winRow === true;

  if (!prospectId) {
    return { isFounder: false, isWithinBonusWindow };
  }

  const { data: prospect } = await admin
    .from("prospects")
    .select("is_founder")
    .eq("id", prospectId)
    .maybeSingle();

  return {
    isFounder: prospect?.is_founder === true,
    isWithinBonusWindow,
  };
}
