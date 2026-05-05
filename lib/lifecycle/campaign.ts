/**
 * Lifecycle des campagnes — déclenche les emails liés au cycle de vie
 * sans nécessiter de cron externe (lazy invocation côté endpoints
 * prospect, comme `lib/settle/ripe.ts`).
 *
 * Deux étapes :
 *   1. expiring-soon (15 min avant ends_at) — mail aux prospects pending
 *      pour les inciter à accepter avant clôture. Idempotence assurée
 *      par le flag campaigns.expiry_warning_sent : on flagge AVANT
 *      d'envoyer (UPDATE … WHERE expiry_warning_sent = false RETURNING)
 *      pour qu'une seule requête concurrente puisse poster.
 *   2. closure (ends_at <= now()) — bascule status='active' → 'completed',
 *      ce qui empêche toute nouvelle décision côté prospect (les RPC
 *      accept/refund vérifient campaign_active). Les relations 'accepted'
 *      seront settled au prochain passage du settle helper.
 *
 * Tous les envois sont fire-and-forget (Promise.allSettled non-await).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendCampaignExpiringSoon } from "@/lib/email/campaign-expiring-soon";

const EXPIRING_SOON_MINUTES = 15;

type RelationRow = {
  id: string;
  reward_cents: number | string;
  prospects:
    | { prospect_identity: { email: string | null; prenom: string | null } | null }
    | null;
};

export async function processCampaignLifecycle(
  admin: SupabaseClient<Database>,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const expiringCutIso = new Date(
    Date.now() + EXPIRING_SOON_MINUTES * 60 * 1000,
  ).toISOString();

  // Étape 1 — expiring-soon. On flagge AVANT d'envoyer pour empêcher
  // toute concurrence (deux requêtes simultanées : une seule passera
  // le UPDATE, l'autre verra 0 row affectée).
  const { data: ripeCampaigns, error: ripeErr } = await admin
    .from("campaigns")
    .update({ expiry_warning_sent: true })
    .eq("status", "active")
    .eq("expiry_warning_sent", false)
    .lte("ends_at", expiringCutIso)
    .gt("ends_at", nowIso)
    .select("id, ends_at, pro_account_id, pro_accounts(raison_sociale)");

  if (ripeErr) {
    console.error("[lifecycle/expiring-soon] flag update failed", ripeErr);
  } else if ((ripeCampaigns ?? []).length > 0) {
    type CampaignRipe = {
      id: string;
      ends_at: string | null;
      pro_account_id: string;
      pro_accounts: { raison_sociale: string | null } | null;
    };
    const campaigns = (ripeCampaigns as unknown as CampaignRipe[]) ?? [];

    // Récupère les destinataires (relations pending, prospects + email).
    for (const c of campaigns) {
      const { data: rels, error: relErr } = await admin
        .from("relations")
        .select(
          `id, reward_cents,
           prospects ( prospect_identity ( email, prenom ) )`,
        )
        .eq("campaign_id", c.id)
        .eq("status", "pending");

      if (relErr) {
        console.error("[lifecycle/expiring-soon] read relations failed", c.id, relErr);
        continue;
      }
      const rows = (rels ?? []) as unknown as RelationRow[];
      if (rows.length === 0) continue;

      const proName = c.pro_accounts?.raison_sociale ?? "le professionnel";
      const endsAt = c.ends_at;

      console.log(
        `[lifecycle/expiring-soon] campagne ${c.id} → ${rows.length} mail(s) pending`,
      );
      void Promise.allSettled(
        rows
          .filter((r) => !!r.prospects?.prospect_identity?.email)
          .map((r) =>
            sendCampaignExpiringSoon({
              email: r.prospects!.prospect_identity!.email!,
              prenom: r.prospects!.prospect_identity!.prenom ?? null,
              proName,
              rewardEur: Number(r.reward_cents) / 100,
              campaignEndsAt: endsAt,
            }),
          ),
      );
    }
  }

  // Étape 2 — closure. Marque les campagnes dont la fenêtre est terminée
  // comme 'completed' (terminal). Le settle helper (settle_ripe_relations)
  // est appelé indépendamment et matérialise les acceptations restantes
  // → mail "vos X € sont disponibles" via lib/email/relation-settled.
  const { error: closeErr } = await admin
    .from("campaigns")
    .update({ status: "completed" })
    .eq("status", "active")
    .lte("ends_at", nowIso);

  if (closeErr) {
    console.error("[lifecycle/closure] status update failed", closeErr);
  }
}
