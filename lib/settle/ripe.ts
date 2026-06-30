/**
 * Settlement lazy des séquestres : une relation `accepted` devient
 * `settled` (escrow prospect → credit disponible) UNIQUEMENT quand sa
 * campagne est clôturée (`campaigns.status = 'completed'`). Délègue à la
 * RPC SQL `settle_ripe_relations` (cf. migration
 * 20260716120000_settle_on_campaign_closure). Le débit du pro a lieu plus
 * tôt, à l'acceptation (`accept_relation_tx`), pas ici. Comme la clôture
 * suit la `ends_at` COURANTE, une prolongation (extend) repousse
 * naturellement le settlement — aucun snapshot de date n'est utilisé.
 *
 * Appelé en début des endpoints prospect (wallet, movements, relations,
 * fiscal), des endpoints pro dépendants de la clôture, et du cron
 * quotidien (backstop). La RPC est idempotente : elle verrouille les
 * lignes et ne renvoie que les rows effectivement transitionnées → un
 * seul mail par relation, même sous requêtes parallèles.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendRelationSettled } from "@/lib/email/relation-settled";
import { processCampaignLifecycle } from "@/lib/lifecycle/campaign";

export async function settleRipeRelationsAndNotify(
  admin: SupabaseClient<Database>,
): Promise<void> {
  // Lifecycle d'abord : envoie l'avertissement "expire dans 15 min" aux
  // prospects pending et bascule les campagnes échues (ends_at dépassé) en
  // 'completed'. Doit tourner AVANT le settle : c'est le passage en
  // 'completed' qui rend les relations acceptées éligibles au settlement.
  await processCampaignLifecycle(admin);

  const { data, error } = await admin.rpc("settle_ripe_relations");
  if (error) {
    console.error("[settle/ripe] RPC failed", error);
    return;
  }
  const rows = data ?? [];
  if (rows.length === 0) return;

  console.log(`[settle/ripe] ${rows.length} relation(s) settled`);

  void (async () => {
    const { recordEvent } = await import("@/lib/admin/events/record");
    for (const r of rows) {
      await recordEvent({
        type: "relation.settled",
        relationId: r.relation_id,
        payload: { rewardCents: Number(r.reward_cents) },
      });
    }
  })();

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
          relationId: r.relation_id,
        }),
      ),
  );
}
