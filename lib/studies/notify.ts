/**
 * Notifications du module (in-app `study_notifications` + e-mails).
 * Toutes les fonctions avalent leurs erreurs : une notification ratée ne
 * doit jamais casser une transition ou une requête utilisateur.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { departmentFromPostalCode } from "./department";
import { REJECT_REASONS, type RejectReason } from "./constants";
import { listPublicStudies, proEmail, prospectIdentities, type StudyRow } from "./repo";
import {
  sendStudyApproved, sendStudyCanceledToProspect, sendStudyDisputeOutcome, sendStudyDisputeToPro,
  sendStudyRejected, sendStudyStatusToPro, sendStudyValidatedToProspect,
} from "@/lib/email/studies";

type Admin = SupabaseClient<Database>;

async function proName(admin: Admin, proId: string): Promise<string> {
  const { data } = await admin.from("pro_accounts").select("raison_sociale").eq("id", proId).maybeSingle();
  return data?.raison_sociale?.trim() || "Un professionnel";
}

/** Publication : notification in-app aux prospects éligibles (palier 1 complet + zone). */
export async function notifyPublished(admin: Admin, c: Pick<StudyRow, "id" | "scope" | "department">): Promise<number> {
  try {
    // Pagination par tranches de 1000 (plafond max_rows de PostgREST).
    let ids: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await admin
        .from("prospect_identity")
        .select("prospect_id, prenom, email")
        .not("prenom", "is", null)
        .not("email", "is", null)
        .order("prospect_id")
        .range(from, from + 999);
      if (error) throw error;
      ids.push(...(page ?? []).filter((r) => r.prenom?.trim() && r.email?.trim()).map((r) => r.prospect_id));
      if (!page || page.length < 1000) break;
    }
    if (c.scope === "department" && c.department) {
      // Filtre par lots de 200 identifiants (URL GET bornée).
      const ok = new Set<string>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: locs, error } = await admin.from("prospect_localisation")
          .select("prospect_id, code_postal").in("prospect_id", ids.slice(i, i + 200));
        if (error) throw error;
        for (const l of locs ?? []) if (departmentFromPostalCode(l.code_postal) === c.department) ok.add(l.prospect_id);
      }
      ids = ids.filter((id) => ok.has(id));
    }
    for (let i = 0; i < ids.length; i += 500) {
      await admin.from("study_notifications").upsert(
        ids.slice(i, i + 500).map((prospect_id) => ({ prospect_id, campaign_id: c.id, kind: "published" })),
        { onConflict: "prospect_id,campaign_id,kind", ignoreDuplicates: true },
      );
    }
    return ids.length;
  } catch (err) {
    console.error("[studies/notify] published", err);
    return 0;
  }
}

async function inApp(admin: Admin, prospectIds: string[], campaignId: string, kind: string) {
  if (!prospectIds.length) return;
  await admin.from("study_notifications").upsert(
    prospectIds.map((prospect_id) => ({ prospect_id, campaign_id: campaignId, kind })),
    { onConflict: "prospect_id,campaign_id,kind", ignoreDuplicates: true },
  );
}

export async function notifyValidated(admin: Admin, campaignId: string): Promise<void> {
  try {
    const { data: c } = await admin.from("study_campaigns").select("*").eq("id", campaignId).single();
    if (!c) return;
    const { data: parts } = await admin.from("study_participations").select("prospect_id, code").eq("campaign_id", campaignId);
    const ids = (parts ?? []).map((p) => p.prospect_id);
    const [idents, name, pEmail] = await Promise.all([prospectIdentities(admin, ids), proName(admin, c.pro_account_id), proEmail(admin, c.pro_account_id)]);
    await inApp(admin, ids, campaignId, "validated");
    const mc = { title: c.title, proName: name, rewardCents: Number(c.reward_cents), completionDeadline: c.completion_deadline, externalUrl: c.external_url, address: c.address };
    await Promise.allSettled((parts ?? []).map((p) => {
      const id = idents.get(p.prospect_id);
      return id?.email && p.code ? sendStudyValidatedToProspect(id.email, id.prenom, mc, p.code) : Promise.resolve();
    }));
    if (pEmail) await sendStudyStatusToPro(pEmail, c.title, "validated", ids.length);
  } catch (err) {
    console.error("[studies/notify] validated", err);
  }
}

/** Annulation : `prospectIds` capturés AVANT l'annulation (qui supprime les inscriptions). */
export async function notifyCanceled(
  admin: Admin,
  c: Pick<StudyRow, "id" | "title" | "pro_account_id">,
  prospectIds: string[],
  reason: "threshold_not_met" | "pro_canceled" | "admin_suspended",
): Promise<void> {
  try {
    const [idents, others, pEmail] = await Promise.all([
      prospectIdentities(admin, prospectIds),
      listPublicStudies(admin, {}, 10),
      proEmail(admin, c.pro_account_id),
    ]);
    const suggestions = others.filter((o) => o.id !== c.id && o.status === "published").slice(0, 3)
      .map((o) => ({ id: o.id, title: o.title, rewardCents: o.rewardCents }));
    await Promise.allSettled(prospectIds.map((pid) => {
      const id = idents.get(pid);
      const why = reason === "pro_canceled" ? "Le professionnel a annulé la campagne avant son lancement."
        : reason === "admin_suspended" ? "BUUPP a suspendu la campagne suite à des signalements." : undefined;
      return id?.email ? sendStudyCanceledToProspect(id.email, id.prenom, c.title, suggestions, why) : Promise.resolve();
    }));
    if (pEmail && reason !== "pro_canceled") await sendStudyStatusToPro(pEmail, c.title, reason === "admin_suspended" ? "suspended" : "canceled", prospectIds.length);
  } catch (err) {
    console.error("[studies/notify] canceled", err);
  }
}

export async function notifyApproved(admin: Admin, participationId: string): Promise<void> {
  try {
    const { data: p } = await admin.from("study_participations").select("prospect_id, campaign_id").eq("id", participationId).single();
    if (!p) return;
    const { data: c } = await admin.from("study_campaigns").select("title, reward_cents").eq("id", p.campaign_id).single();
    if (!c) return;
    const id = (await prospectIdentities(admin, [p.prospect_id])).get(p.prospect_id);
    if (id?.email) await sendStudyApproved(id.email, id.prenom, c.title, Number(c.reward_cents));
  } catch (err) {
    console.error("[studies/notify] approved", err);
  }
}

export async function notifyRejected(admin: Admin, participationId: string): Promise<void> {
  try {
    const { data: p } = await admin.from("study_participations").select("prospect_id, campaign_id, reject_reason, reject_note").eq("id", participationId).single();
    if (!p) return;
    const { data: c } = await admin.from("study_campaigns").select("title").eq("id", p.campaign_id).single();
    if (!c) return;
    const id = (await prospectIdentities(admin, [p.prospect_id])).get(p.prospect_id);
    const label = REJECT_REASONS[p.reject_reason as RejectReason] ?? "Autre";
    const reason = p.reject_reason === "other" && p.reject_note ? `${label} — ${p.reject_note}` : label;
    if (id?.email) await sendStudyRejected(id.email, id.prenom, c.title, reason);
  } catch (err) {
    console.error("[studies/notify] rejected", err);
  }
}

export async function notifyDispute(admin: Admin, participationId: string, outcome: "opened" | "approved" | "rejected"): Promise<void> {
  try {
    const { data: p } = await admin.from("study_participations").select("prospect_id, campaign_id").eq("id", participationId).single();
    if (!p) return;
    const { data: c } = await admin.from("study_campaigns").select("title, pro_account_id").eq("id", p.campaign_id).single();
    if (!c) return;
    const pEmail = await proEmail(admin, c.pro_account_id);
    if (pEmail) await sendStudyDisputeToPro(pEmail, c.title, outcome);
    if (outcome !== "opened") {
      const id = (await prospectIdentities(admin, [p.prospect_id])).get(p.prospect_id);
      if (id?.email) await sendStudyDisputeOutcome(id.email, id.prenom, c.title, outcome === "approved");
    } else {
      const { sendAdminCriticalAlert } = await import("@/lib/email/admin-alert");
      await sendAdminCriticalAlert({ type: "studies.dispute_opened", payload: { participationId, campaign: c.title }, createdAt: new Date().toISOString() });
    }
  } catch (err) {
    console.error("[studies/notify] dispute", err);
  }
}
