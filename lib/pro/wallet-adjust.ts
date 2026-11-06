/**
 * Ajustement ATOMIQUE du portefeuille pro (deltas relatifs, RPC
 * `pro_wallet_adjust`). Remplace les écritures « lire puis réécrire une
 * valeur absolue » qui écrasaient les mouvements concurrents (réservations
 * et débits Tests & Études, recharges).
 *
 * Repli : tant que la migration 20261107120000 n'est pas appliquée, la RPC
 * n'existe pas (PGRST202) → on retombe sur l'ancien comportement pour ne
 * rien casser en production.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function adjustProWallet(
  admin: SupabaseClient<Database>,
  proId: string,
  d: { balanceDelta?: number; reservedDelta?: number },
): Promise<void> {
  const balanceDelta = d.balanceDelta ?? 0;
  const reservedDelta = d.reservedDelta ?? 0;
  const { error } = await admin.rpc("pro_wallet_adjust", {
    p_pro: proId,
    p_balance_delta: balanceDelta,
    p_reserved_delta: reservedDelta,
  });
  if (!error) return;
  if (error.code !== "PGRST202") throw new Error(error.message);

  const { data: row } = await admin
    .from("pro_accounts")
    .select("wallet_balance_cents, wallet_reserved_cents")
    .eq("id", proId)
    .single();
  if (!row) throw new Error("pro_not_found");
  await admin
    .from("pro_accounts")
    .update({
      wallet_balance_cents: Number(row.wallet_balance_cents ?? 0) + balanceDelta,
      wallet_reserved_cents: Math.max(0, Number(row.wallet_reserved_cents ?? 0) + reservedDelta),
    })
    .eq("id", proId);
}
