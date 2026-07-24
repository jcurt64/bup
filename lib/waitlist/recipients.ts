/**
 * Lecture de l'audience « liste d'attente » pour les envois de masse.
 *
 * Point d'entrée unique partagé par :
 *   • POST /api/admin/broadcasts            (broadcast admin, audience waitlist)
 *   • GET  /api/admin/broadcasts/audience   (aperçu avant envoi)
 *   • POST /api/admin/waitlist/launch-email (mail de lancement officiel)
 *
 * Garantit qu'aucun de ces chemins ne peut écrire à une ligne fictive :
 * le filtrage est fait ici, pas dans l'appelant (cf. lib/waitlist/test-accounts).
 */

import type { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  partitionWaitlistRecipients,
  type WaitlistExclusion,
} from "./test-accounts";

export type WaitlistRecipient = {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  ville: string;
};

export type WaitlistAudience = {
  /** Destinataires réels, dédupliqués. */
  recipients: WaitlistRecipient[];
  /** Lignes écartées (comptes de test, doublons, adresses invalides). */
  excluded: WaitlistExclusion<WaitlistRecipient>[];
  /** Nombre de lignes lues en base, avant filtrage. */
  totalRows: number;
};

export async function collectWaitlistAudience(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  opts: { onlyNotLaunchEmailed?: boolean; limit?: number } = {},
): Promise<WaitlistAudience> {
  let query = admin
    .from("waitlist")
    .select("id, email, prenom, nom, ville")
    .not("email", "is", null)
    .order("created_at", { ascending: true });

  // Utilisé par le mail de lancement, idempotent via launch_email_sent_at.
  if (opts.onlyNotLaunchEmailed) query = query.is("launch_email_sent_at", null);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    console.error("[waitlist/recipients] lecture échouée", error);
    return { recipients: [], excluded: [], totalRows: 0 };
  }

  const rows: WaitlistRecipient[] = (data ?? []).map((r) => ({
    id: String(r.id),
    email: (r.email ?? "").trim(),
    prenom: (r.prenom ?? "").trim(),
    nom: (r.nom ?? "").trim(),
    ville: (r.ville ?? "").trim(),
  }));

  const { included, excluded } = partitionWaitlistRecipients(rows);
  return { recipients: included, excluded, totalRows: rows.length };
}
