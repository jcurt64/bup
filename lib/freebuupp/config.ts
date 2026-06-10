/**
 * Flag d'activation FREEBUUPP (`app_config.freebuupp_enabled`).
 *
 * Le service est livré DÉSACTIVÉ (défaut false). Tant que le flag est off :
 *  - aucune entrée de menu n'apparaît côté pro/prospect (gating UI via /api/me) ;
 *  - les écritures (création d'un FREEBUUPP, participation) sont refusées (403).
 * Le flag est lu en DB → activable plus tard sans redéploiement.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

export async function isFreebuuppEnabled(admin: Admin): Promise<boolean> {
  const { data } = await admin
    .from("app_config")
    .select("freebuupp_enabled")
    .limit(1)
    .maybeSingle();
  return data?.freebuupp_enabled === true;
}
