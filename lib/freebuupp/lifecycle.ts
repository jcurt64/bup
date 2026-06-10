/**
 * Cycle de vie d'un FREEBUUPP : fermeture, tirage (idempotent), remboursement
 * 0-inscrit, et backstop quotidien. Réutilisé par l'API draw ET le cron.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { drawWinners } from "./draw";
import { shouldRefund } from "./pricing";
import { notifyFreebuuppResults } from "./mail";

type Admin = SupabaseClient<Database>;

export type DrawOutcome =
  | { status: "drawn"; winners: number[] }
  | { status: "canceled" }
  | { status: "noop"; reason: string };

/**
 * Exécute le tirage d'un freebuupp. Idempotent : ne fait rien si déjà
 * `drawn`/`canceled`. Marque `is_winner`, passe en `drawn`, renvoie les
 * numéros gagnants. Si 0 inscrit → `canceled` + remboursement des 10 €.
 * Les notifications sont déclenchées par l'appelant (API/cron).
 */
export async function executeDraw(admin: Admin, freebuuppId: string): Promise<DrawOutcome> {
  const { data: fb } = await admin
    .from("freebuupps")
    .select("id, pro_account_id, status, seed, winners_count, fee_cents")
    .eq("id", freebuuppId)
    .single();
  if (!fb) return { status: "noop", reason: "not_found" };
  if (fb.status === "drawn" || fb.status === "canceled") {
    return { status: "noop", reason: "already_final" };
  }

  const { data: parts } = await admin
    .from("freebuupp_participants")
    .select("id, participant_number")
    .eq("freebuupp_id", freebuuppId);
  const rows = parts ?? [];
  const participants = rows.map((p) => p.participant_number);

  // Aucun inscrit → remboursement + annulation.
  if (shouldRefund(participants.length)) {
    const { data: pro } = await admin
      .from("pro_accounts")
      .select("wallet_balance_cents")
      .eq("id", fb.pro_account_id)
      .single();
    if (pro) {
      await admin
        .from("pro_accounts")
        .update({ wallet_balance_cents: Number(pro.wallet_balance_cents) + Number(fb.fee_cents) })
        .eq("id", fb.pro_account_id);
      await admin.from("transactions").insert({
        account_id: fb.pro_account_id,
        account_kind: "pro",
        type: "buupp_commission",
        status: "completed",
        amount_cents: Number(fb.fee_cents),
        freebuupp_id: fb.id,
        description: "Remboursement FREEBUUPP (aucun inscrit)",
      });
    }
    await admin
      .from("freebuupps")
      .update({ status: "canceled", refunded: true, drawn_at: new Date().toISOString() })
      .eq("id", fb.id);
    return { status: "canceled" };
  }

  const result = drawWinners({
    seed: fb.seed ?? "",
    participants,
    winnersCount: fb.winners_count,
  });
  const winnerSet = new Set(result.winners);
  const winnerIds = rows.filter((p) => winnerSet.has(p.participant_number)).map((p) => p.id);
  if (winnerIds.length > 0) {
    await admin.from("freebuupp_participants").update({ is_winner: true }).in("id", winnerIds);
  }
  await admin
    .from("freebuupps")
    .update({ status: "drawn", drawn_at: new Date().toISOString() })
    .eq("id", fb.id);
  return { status: "drawn", winners: result.winners };
}

/**
 * Backstop quotidien (appelé par /api/admin/digest) :
 *  - ferme les `open` expirés (closes_at <= now) → `closed`
 *  - tire les `closed` ouverts depuis > 48 h (pro inactif) + notifie
 */
export async function freebuuppLifecycleTick(admin: Admin): Promise<{ closed: number; drawn: number }> {
  const now = Date.now();
  let closed = 0;
  let drawn = 0;

  const { data: toClose } = await admin
    .from("freebuupps")
    .select("id")
    .eq("status", "open")
    .lte("closes_at", new Date(now).toISOString());
  for (const r of toClose ?? []) {
    await admin.from("freebuupps").update({ status: "closed" }).eq("id", r.id);
    closed++;
  }

  const cutoff = new Date(now - 48 * 3600 * 1000).toISOString();
  const { data: toDraw } = await admin
    .from("freebuupps")
    .select("id")
    .eq("status", "closed")
    .lte("closes_at", cutoff);
  for (const r of toDraw ?? []) {
    const res = await executeDraw(admin, r.id);
    if (res.status === "drawn") {
      drawn++;
      try {
        await notifyFreebuuppResults(admin, r.id);
      } catch (e) {
        console.error("[freebuupp/lifecycle] notify failed", e);
      }
    } else if (res.status === "canceled") {
      drawn++;
    }
  }
  return { closed, drawn };
}
