/**
 * Exécution des transitions d'échéance (spec §9). Idempotent : chaque
 * transition passe par une RPC qui verrouille et revérifie le statut, donc
 * deux balayages concurrents ne paient jamais deux fois.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { planTransitions, type Transition } from "./plan";
import { notifyApproved, notifyCanceled, notifyValidated } from "./notify";

type Admin = SupabaseClient<Database>;

const SWEEP_COLS =
  "id, title, pro_account_id, status, min_participants, max_participants, signup_deadline, completion_deadline, closed_at, canceled_at, purged_at, budget_reserved_cents";

async function apply(admin: Admin, c: { id: string; title: string; pro_account_id: string }, t: Transition): Promise<void> {
  switch (t.kind) {
    case "validate": {
      const { data } = await admin.rpc("validate_study_tx", { p_id: c.id });
      if (data) await notifyValidated(admin, c.id);
      return;
    }
    case "cancel": {
      const { data: parts } = await admin.from("study_participations").select("prospect_id").eq("campaign_id", c.id);
      const { data, error } = await admin.rpc("cancel_study_tx", { p_id: c.id, p_reason: "threshold_not_met" });
      // data NULL = no-op (déjà annulée par un balayage concurrent, ou seuil atteint) → pas de mail.
      if (!error && data !== null) await notifyCanceled(admin, c, (parts ?? []).map((p) => p.prospect_id), "threshold_not_met");
      return;
    }
    case "not_done":
      await admin.from("study_participations").update({ status: "not_done" }).eq("id", t.id).eq("status", "confirmed");
      return;
    case "auto_approve": {
      const { data } = await admin.rpc("approve_study_participation_tx", { p_participation: t.id, p_by: "auto" });
      if (data) await notifyApproved(admin, t.id);
      return;
    }
    case "reject_final":
      await admin.from("study_participations").update({ status: "rejected_final", resolved_at: new Date().toISOString() }).eq("id", t.id).eq("status", "rejected");
      return;
    case "close":
      await admin.rpc("close_study_tx", { p_id: c.id });
      return;
    case "purge": {
      await admin.from("study_participations")
        .update({ code: null, done_comment: null, reject_note: null, dispute_note: null })
        .eq("campaign_id", c.id);
      const { data: parts } = await admin.from("study_participations").select("id").eq("campaign_id", c.id);
      const ids = (parts ?? []).map((p) => p.id);
      if (ids.length) {
        await admin.from("relation_email_aliases").update({ revoked_at: new Date().toISOString() }).in("study_participation_id", ids);
      }
      await admin.from("study_campaigns").update({ purged_at: new Date().toISOString() }).eq("id", c.id);
      return;
    }
  }
}

async function sweepRows(admin: Admin, rows: Array<Parameters<typeof planTransitions>[0] & { title: string; pro_account_id: string }>, now: Date) {
  if (!rows.length) return 0;
  let n = 0;
  for (const c of rows) {
    // Une requête par campagne (≤ 500 lignes, sous le plafond max_rows de
    // PostgREST). En cas d'erreur, on ne planifie RIEN pour cette campagne :
    // un décompte vide ferait croire à un seuil non atteint.
    const { data: parts, error } = await admin
      .from("study_participations")
      .select("id, campaign_id, status, review_due_at, rejected_at")
      .eq("campaign_id", c.id)
      .limit(1000);
    if (error || !parts) {
      console.error("[studies/sweep] participations read failed", c.id, error);
      continue;
    }
    const ts = planTransitions(c, parts, now);
    for (const t of ts) {
      try {
        await apply(admin, c, t);
        n++;
      } catch (err) {
        console.error("[studies/sweep]", t, err);
      }
    }
  }
  return n;
}

/** Balayage d'une campagne (appelé à chaque lecture). */
export async function sweepStudy(admin: Admin, id: string, now = new Date()): Promise<number> {
  const { data } = await admin.from("study_campaigns").select(SWEEP_COLS).eq("id", id).maybeSingle();
  return data ? sweepRows(admin, [data], now) : 0;
}

/** Balayage de plusieurs campagnes (listes pro / prospect / publique). */
export async function sweepStudies(admin: Admin, ids: string[], now = new Date()): Promise<number> {
  if (!ids.length) return 0;
  const { data } = await admin.from("study_campaigns").select(SWEEP_COLS).in("id", ids);
  return sweepRows(admin, data ?? [], now);
}

/** Balayage global quotidien (cron). */
export async function sweepAllStudies(admin: Admin, now = new Date()): Promise<number> {
  const { data } = await admin
    .from("study_campaigns")
    .select(SWEEP_COLS)
    .or("status.in.(published,validated),and(status.eq.canceled,purged_at.is.null),and(status.eq.closed,purged_at.is.null)")
    .limit(1000);
  return sweepRows(admin, data ?? [], now);
}
