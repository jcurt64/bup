/**
 * Settlement lazy des relations matures (3 minutes après le lancement
 * de la campagne). Délègue à la RPC SQL atomique `settle_ripe_relations`
 * (cf. supabase/migrations/20260505000000_settle_ripe_relations.sql) puis
 * notifie chaque prospect concerné par mail (fire-and-forget).
 *
 * Appelé en début de chaque endpoint prospect qui consomme du wallet ou
 * des relations (wallet, movements, relations, fiscal). La RPC est
 * idempotente : elle verrouille les lignes et ne renvoie que les rows
 * effectivement transitionnées → un seul mail par relation, même si
 * plusieurs requêtes parallèles déclenchent le settle au même moment.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendRelationSettled } from "@/lib/email/relation-settled";
import { processCampaignLifecycle } from "@/lib/lifecycle/campaign";

export async function settleRipeRelationsAndNotify(
  admin: SupabaseClient<Database>,
): Promise<void> {
  // Lifecycle d'abord : envoie l'avertissement "expire dans 15 min" aux
  // prospects pending et bascule les campagnes échues en 'completed'.
  // Doit tourner AVANT le settle pour que les acceptations retardataires
  // dans la fenêtre [created+3min … ends_at] soient settled correctement.
  await processCampaignLifecycle(admin);

  const { data, error } = await admin.rpc("settle_ripe_relations");
  if (error) {
    console.error("[settle/ripe] RPC failed", error);
    return;
  }
  const rows = data ?? [];
  if (rows.length === 0) return;

  console.log(`[settle/ripe] ${rows.length} relation(s) settled`);

  // Mails fire-and-forget — un échec d'envoi ne doit ni bloquer ni faire
  // remonter d'erreur dans la requête API qui a déclenché le settle.
  void Promise.allSettled(
    rows
      .filter((r) => !!r.prospect_email)
      .map((r) =>
        sendRelationSettled({
          email: r.prospect_email!,
          prenom: r.prospect_prenom,
          proName: r.pro_name ?? "le professionnel",
          rewardEur: Number(r.reward_cents) / 100,
        }),
      ),
  );
}
