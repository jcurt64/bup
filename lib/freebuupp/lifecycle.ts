/**
 * Cycle de vie d'un FREEBUUPP : fermeture, tirage AUTOMATIQUE à la clôture
 * (idempotent), remboursement 0-inscrit.
 *
 * Le tirage est 100 % automatique (aucune action du pro) :
 *  - `autoDrawOne` / `sweepDueFreebuupps` sont appelés en LECTURE (dès qu'une
 *    page FREEBUUPP est consultée après la clôture, le tirage se déclenche) ;
 *  - `freebuuppLifecycleTick` est appelé par le cron quotidien (filet de
 *    sécurité pour les tirages jamais consultés).
 * Les notifications partent via `after()` (post-réponse, non bloquant).
 */

import { after } from "next/server";
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
 * Tire AUTOMATIQUEMENT un FREEBUUPP s'il a dépassé sa clôture (closes_at) et
 * n'est pas encore tiré. Idempotent : noop si pas échu ou déjà final.
 * Les notifications sont planifiées via `after()` (non bloquant) — valable
 * aussi bien dans une route de lecture que dans le cron (route handler).
 */
export async function autoDrawOne(admin: Admin, freebuuppId: string): Promise<DrawOutcome> {
  const { data: fb } = await admin
    .from("freebuupps")
    .select("status, closes_at, panel_size")
    .eq("id", freebuuppId)
    .single();
  if (!fb) return { status: "noop", reason: "not_found" };
  if (fb.status === "drawn" || fb.status === "canceled") {
    return { status: "noop", reason: "already_final" };
  }
  // Échu = clôture (24 h) dépassée OU panel complet (dernière place prise).
  let due = new Date(fb.closes_at).getTime() <= Date.now();
  if (!due) {
    const { count } = await admin
      .from("freebuupp_participants")
      .select("id", { count: "exact", head: true })
      .eq("freebuupp_id", freebuuppId);
    due = (count ?? 0) >= fb.panel_size;
  }
  if (!due) return { status: "noop", reason: "not_due" };
  // Matérialise la fermeture si encore 'open', puis tire.
  if (fb.status === "open") {
    await admin.from("freebuupps").update({ status: "closed" }).eq("id", freebuuppId);
  }
  const res = await executeDraw(admin, freebuuppId);
  if (res.status === "drawn") {
    after(() =>
      notifyFreebuuppResults(admin, freebuuppId).catch((e) =>
        console.error("[freebuupp/autoDraw] notify failed", e),
      ),
    );
  }
  return res;
}

/**
 * Tire tous les FREEBUUPP échus — clôture (closes_at <= now) OU panel complet —
 * parmi les non-finalisés. Appelé en tête des routes de lecture (tirage
 * paresseux) ET par le cron. 2 requêtes au total puis autoDrawOne par item dû.
 */
export async function sweepDueFreebuupps(admin: Admin, limit = 200): Promise<{ drawn: number }> {
  const { data: rows } = await admin
    .from("freebuupps")
    .select("id, panel_size, closes_at")
    .in("status", ["open", "closed"])
    .limit(limit);
  if (!rows || rows.length === 0) return { drawn: 0 };

  const ids = rows.map((r) => r.id);
  const { data: parts } = await admin
    .from("freebuupp_participants")
    .select("freebuupp_id")
    .in("freebuupp_id", ids);
  const counts = new Map<string, number>();
  for (const p of parts ?? []) counts.set(p.freebuupp_id, (counts.get(p.freebuupp_id) ?? 0) + 1);

  const now = Date.now();
  let drawn = 0;
  for (const r of rows) {
    const due =
      new Date(r.closes_at).getTime() <= now || (counts.get(r.id) ?? 0) >= r.panel_size;
    if (!due) continue;
    const res = await autoDrawOne(admin, r.id);
    if (res.status === "drawn" || res.status === "canceled") drawn++;
  }
  return { drawn };
}

/** Filet de sécurité quotidien (appelé par /api/admin/digest). */
export async function freebuuppLifecycleTick(admin: Admin): Promise<{ drawn: number }> {
  return sweepDueFreebuupps(admin);
}
