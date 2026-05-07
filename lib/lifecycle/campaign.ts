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

  // Étape 1.5 — auto-resume. Les campagnes 7d en pause depuis ≥ 48 h
  // (paused_at + 48h <= now()) repassent automatiquement en 'active'.
  // ends_at est décalé de la durée effective de la pause pour préserver
  // le temps restant qu'il y avait au moment de la pause.
  const { data: pausedRipe, error: pauseReadErr } = await admin
    .from("campaigns")
    .select("id, paused_at, auto_resume_at, ends_at")
    .eq("status", "paused")
    .lte("auto_resume_at", nowIso);
  if (pauseReadErr) {
    console.error("[lifecycle/auto-resume] read failed", pauseReadErr);
  } else if ((pausedRipe ?? []).length > 0) {
    for (const c of pausedRipe!) {
      const pausedAt = c.paused_at ? new Date(c.paused_at).getTime() : 0;
      const pauseMs = pausedAt > 0 ? Math.max(0, Date.now() - pausedAt) : 0;
      const newEndsAt = c.ends_at
        ? new Date(new Date(c.ends_at).getTime() + pauseMs).toISOString()
        : null;
      const { error: updErr } = await admin
        .from("campaigns")
        .update({
          status: "active",
          paused_at: null,
          auto_resume_at: null,
          ...(newEndsAt ? { ends_at: newEndsAt } : {}),
        })
        .eq("id", c.id)
        .eq("status", "paused");
      if (updErr) {
        console.error("[lifecycle/auto-resume] update failed", c.id, updErr);
      }
    }
  }

  // Étape 2 — closure. Pour chaque campagne dont `ends_at <= now()` et
  // status='active', on appelle `close_campaign_settle` qui :
  //   1. flushe les relations encore mûres (settle_ripe_relations).
  //   2. libère le résidu de réservation (refus / expirations / écart
  //      entre budget prévu et acceptations effectives).
  //   3. passe la campagne en `completed` avec `settled_at`.
  // Les débits pro et la maturation des escrow prospect se font désormais
  // PER-RELATION dans `settle_ripe_relations`, basé sur
  // `relations.escrow_release_at` (snapshot du ends_at à l'acceptation).
  // Une prolongation de campagne ne décale donc plus l'échéance des
  // séquestres déjà ouverts.
  const { data: expiredCamps, error: expErr } = await admin
    .from("campaigns")
    .select("id")
    .eq("status", "active")
    .lte("ends_at", nowIso);

  if (expErr) {
    console.error("[lifecycle/closure] read expired failed", expErr);
  } else if ((expiredCamps ?? []).length > 0) {
    for (const c of expiredCamps!) {
      const { error: rpcErr } = await admin.rpc("close_campaign_settle", {
        p_campaign_id: c.id as string,
      });
      if (rpcErr) {
        console.error("[lifecycle/closure] close_campaign_settle failed", c.id, rpcErr);
      }
    }
  }
}
