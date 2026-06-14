/**
 * Rétention du journal d'audit des révélations (`pro_contact_reveals`).
 *
 * Conformité RGPD — minimisation / limitation de la conservation (art. 5.1.e) :
 * un journal d'accès aux données personnelles ne doit pas être conservé
 * indéfiniment. Au-delà de `REVEALS_RETENTION_MONTHS`, les entrées sont purgées.
 *
 * La purge est appelée quotidiennement en piggyback du cron `/api/admin/digest`
 * (Vercel Hobby = 1 cron/jour). Idempotente. Le verrou append-only de la table
 * n'interdit que l'UPDATE, pas le DELETE → la purge reste possible.
 *
 * ⚠️ Durée = choix de politique RGPD à valider avec le DPO. 24 mois couvre les
 * besoins d'accountability / contentieux sans sur-conservation.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

export const REVEALS_RETENTION_MONTHS = 24;

/**
 * Supprime les entrées du journal antérieures à `months` mois.
 * Retourne le nombre de lignes purgées.
 */
export async function purgeOldContactReveals(
  admin: Admin,
  months: number = REVEALS_RETENTION_MONTHS,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const { data, error } = await admin
    .from("pro_contact_reveals")
    .delete()
    .lt("revealed_at", cutoff.toISOString())
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}
