/**
 * Passage quotidien du module (greffé sur le cron `/api/admin/digest?severity=daily`) :
 *  1. balayage global des échéances ;
 *  2. rappels J-2 avant la fin de réalisation (dédup `reminder_sent_at`) ;
 *  3. récapitulatif e-mail des nouvelles campagnes (opt-in, ≤ 1/jour) ;
 *  4. récapitulatif pro des participations à examiner.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sweepAllStudies } from "./sweep";
import { proEmail, prospectIdentities } from "./repo";
import { signUnsubscribe } from "./unsubscribe";
import { REMINDER_HOURS } from "./constants";
import { sendStudyDigest, sendStudyProReviewDigest, sendStudyReminder, STUDIES_APP_URL } from "@/lib/email/studies";

type Admin = SupabaseClient<Database>;

export async function runStudiesDaily(admin: Admin, now = new Date()) {
  const out = { transitions: 0, reminders: 0, digests: 0, proDigests: 0 };
  const { data: flag } = await admin.from("app_config").select("studies_enabled").maybeSingle();
  if (!flag?.studies_enabled) return out;

  out.transitions = await sweepAllStudies(admin, now);

  // 2. Rappels J-2
  const soon = new Date(now.getTime() + REMINDER_HOURS * 3600 * 1000).toISOString();
  const { data: camps } = await admin.from("study_campaigns")
    .select("id, title, pro_account_id, reward_cents, completion_deadline, external_url, address")
    .eq("status", "validated").gt("completion_deadline", now.toISOString()).lte("completion_deadline", soon);
  for (const c of camps ?? []) {
    const { data: parts } = await admin.from("study_participations").select("id, prospect_id, code")
      .eq("campaign_id", c.id).eq("status", "confirmed").is("reminder_sent_at", null);
    if (!parts?.length) continue;
    const { data: pro } = await admin.from("pro_accounts").select("raison_sociale").eq("id", c.pro_account_id).maybeSingle();
    const idents = await prospectIdentities(admin, parts.map((p) => p.prospect_id));
    for (const p of parts) {
      const id = idents.get(p.prospect_id);
      if (id?.email) {
        await sendStudyReminder(id.email, id.prenom, {
          title: c.title, proName: pro?.raison_sociale ?? "Le professionnel", rewardCents: Number(c.reward_cents),
          completionDeadline: c.completion_deadline, externalUrl: c.external_url, address: c.address,
        }, p.code);
        out.reminders++;
      }
      await admin.from("study_participations").update({ reminder_sent_at: now.toISOString() }).eq("id", p.id);
    }
  }

  // 3. Récapitulatif e-mail (opt-in)
  const since = new Date(now.getTime() - 20 * 3600 * 1000).toISOString();
  // Filtre côté SQL : au plus 1000 abonnés par passage (max_rows) ; ceux
  // traités sortent du filtre, les suivants passent au tour d'après.
  const { data: subs } = await admin.from("prospects").select("id")
    .eq("studies_email_digest", true)
    .or(`studies_digest_sent_at.is.null,studies_digest_sent_at.lt.${since}`)
    .limit(1000);
  const due = (subs ?? []).map((s) => s.id);
  if (due.length) {
    const idents = await prospectIdentities(admin, due);
    for (const pid of due) {
      const { data: notifs } = await admin.from("study_notifications").select("id, campaign_id")
        .eq("prospect_id", pid).eq("kind", "published").is("emailed_at", null).limit(20);
      if (!notifs?.length) continue;
      const { data: open } = await admin.from("study_campaigns").select("id, title, reward_cents")
        .in("id", notifs.map((n) => n.campaign_id)).eq("status", "published");
      const id = idents.get(pid);
      if (open?.length && id?.email) {
        await sendStudyDigest(id.email, id.prenom,
          open.map((o) => ({ id: o.id, title: o.title, rewardCents: Number(o.reward_cents) })),
          `${STUDIES_APP_URL}/api/studies/unsubscribe?t=${encodeURIComponent(signUnsubscribe(pid))}`);
        out.digests++;
      }
      await admin.from("study_notifications").update({ emailed_at: now.toISOString() }).in("id", notifs.map((n) => n.id));
      await admin.from("prospects").update({ studies_digest_sent_at: now.toISOString() }).eq("id", pid);
    }
  }

  // 4. Récapitulatif pro : participations « terminées » à examiner
  const { data: toReview } = await admin.from("study_participations").select("campaign_id").eq("status", "done");
  if (toReview?.length) {
    const byCamp = new Map<string, number>();
    for (const r of toReview) byCamp.set(r.campaign_id, (byCamp.get(r.campaign_id) ?? 0) + 1);
    const { data: cs } = await admin.from("study_campaigns").select("id, title, pro_account_id").in("id", [...byCamp.keys()]);
    const byPro = new Map<string, { title: string; count: number }[]>();
    for (const c of cs ?? []) {
      byPro.set(c.pro_account_id, [...(byPro.get(c.pro_account_id) ?? []), { title: c.title, count: byCamp.get(c.id) ?? 0 }]);
    }
    for (const [proId, rows] of byPro) {
      const email = await proEmail(admin, proId);
      if (email) { await sendStudyProReviewDigest(email, rows); out.proDigests++; }
    }
  }
  return out;
}
