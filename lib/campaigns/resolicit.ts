/**
 * Re-sollicitation après ÉLARGISSEMENT d'une campagne en cours.
 *
 * Quand un pro élargit la zone géo ou la tranche d'âge (cf. PATCH
 * /api/pro/campaigns/[id], branche édition), les prospects désormais dans la
 * cible MAIS pas encore sollicités doivent recevoir la sollicitation —
 * exactement comme au lancement.
 *
 * Garde-fou budget : on ne dépasse JAMAIS le nombre de contacts déjà payé
 * (`contact_quota` = budget réservé au lancement). On ne fait que COMBLER les
 * places restantes (quota − déjà sollicités). Aucun débit supplémentaire : la
 * réservation du lancement couvre déjà ce nombre d'acceptations.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { findMatchingProspects, type MatchingInput } from "./matching";
import { sendRelationInvitation } from "@/lib/email/relation";
import {
  buildClassicPayload,
  buildFlashPayload,
  sendBatch,
  type ExpoPushMessage,
} from "@/lib/push/expo";

type Targeting = {
  objectiveId?: string;
  requiredTiers?: number[];
  geo?: string;
  geoTarget?:
    | { type: "ville"; nom?: string; code?: string; codesPostaux?: string[] }
    | { type: "dept"; nom?: string; code?: string }
    | { type: "region"; nom?: string; code?: string; deptCodes?: string[] }
    | null;
  radiusKm?: number | null;
  ages?: string[];
  verifLevel?: string;
  excludeCertified?: boolean;
  durationKey?: string | null;
  minFiabilite?: number | null;
};

/** Nombre de nouvelles sollicitations autorisées = quota payé − déjà
 *  sollicités (pool ciblé, hors relations « extra » filleuls). Jamais négatif. */
export function remainingSolicitationSlots(
  targetCount: number,
  alreadyTargeted: number,
): number {
  return Math.max(0, Math.floor(targetCount) - Math.floor(alreadyTargeted));
}

export type ResolicitResult = {
  added: number;
  reason?:
    | "not_found"
    | "forbidden"
    | "closed"
    | "no_quota"
    | "quota_full"
    | "no_new_match"
    | "matching_failed"
    | "insert_failed";
};

/**
 * Sollicite les prospects nouvellement éligibles d'une campagne, dans la limite
 * des places restantes. Best-effort : renvoie le nombre réellement ajouté.
 */
export async function resolicitNewlyEligible(
  admin: SupabaseClient<Database>,
  campaignId: string,
  proId: string,
): Promise<ResolicitResult> {
  const { data: camp, error: campErr } = await admin
    .from("campaigns")
    .select(
      "id, status, targeting, budget_cents, cost_per_contact_cents, contact_quota, matched_count, ends_at, brief, pro_account_id",
    )
    .eq("id", campaignId)
    .single();
  if (campErr || !camp) return { added: 0, reason: "not_found" };
  if (camp.pro_account_id !== proId) return { added: 0, reason: "forbidden" };
  if (camp.status !== "active" && camp.status !== "paused") {
    return { added: 0, reason: "closed" };
  }

  const t = (camp.targeting as Targeting | null) ?? {};
  const cpc = Number(camp.cost_per_contact_cents ?? 0);
  const budget = Number(camp.budget_cents ?? 0);
  const targetCount =
    Number(camp.contact_quota ?? 0) || (cpc > 0 ? Math.round(budget / cpc) : 0);
  if (targetCount <= 0) return { added: 0, reason: "no_quota" };

  // Prospects déjà sollicités (tous statuts). `referral_extra` = relations
  // filleuls hors-cible (bonus parrain) → exclues du décompte du quota ciblé,
  // mais incluses dans l'exclusion de re-sélection (on ne re-sollicite personne).
  const { data: existing, error: exErr } = await admin
    .from("relations")
    .select("prospect_id, referral_extra")
    .eq("campaign_id", campaignId);
  if (exErr) return { added: 0, reason: "matching_failed" };
  const existingRows = existing ?? [];
  const existingIds = existingRows.map((r) => r.prospect_id);
  const targetedCount = existingRows.filter((r) => !r.referral_extra).length;

  const remaining = remainingSolicitationSlots(targetCount, targetedCount);
  if (remaining <= 0) return { added: 0, reason: "quota_full" };

  const { data: pro } = await admin
    .from("pro_accounts")
    .select("code_postal, latitude, longitude, raison_sociale, secteur")
    .eq("id", proId)
    .single();

  let matched: Awaited<ReturnType<typeof findMatchingProspects>>;
  try {
    matched = await findMatchingProspects(admin, {
      objectiveId: t.objectiveId ?? "",
      requiredTiers: t.requiredTiers ?? [],
      geo: t.geo ?? "national",
      // Le geoTarget stocké est déjà normalisé (cf. POST /campaigns) → cast sûr.
      geoTarget: (t.geoTarget ?? null) as MatchingInput["geoTarget"],
      proCodePostal: pro?.code_postal ?? null,
      proLat: pro?.latitude ?? null,
      proLng: pro?.longitude ?? null,
      radiusKm: t.radiusKm ?? null,
      ages: t.ages ?? [],
      verifLevel: t.verifLevel ?? "p0",
      contacts: remaining,
      excludeCertified: t.excludeCertified === true,
      excludeProspectIds: existingIds,
      minFiabilitePct: t.minFiabilite ?? null,
    });
  } catch (e) {
    console.error("[resolicit] matching failed", e);
    return { added: 0, reason: "matching_failed" };
  }
  if (matched.length === 0) return { added: 0, reason: "no_new_match" };

  const motif = (camp.brief ?? "").trim();
  const expiresAt =
    camp.ends_at ?? new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const rewardCents = (m: (typeof matched)[number]) =>
    m.verification === "certifie_confiance" ? cpc * 2 : cpc;

  const rows = matched.map((m) => ({
    campaign_id: campaignId,
    pro_account_id: proId,
    prospect_id: m.prospectId,
    motif,
    reward_cents: rewardCents(m),
    status: "pending" as const,
    expires_at: expiresAt,
  }));
  const { data: inserted, error: insErr } = await admin
    .from("relations")
    .insert(rows)
    .select("id, prospect_id");
  if (insErr) {
    console.error("[resolicit] insert relations failed", insErr);
    return { added: 0, reason: "insert_failed" };
  }
  const added = inserted?.length ?? 0;
  const relIdByProspect = new Map<string, string>();
  for (const r of inserted ?? []) relIdByProspect.set(r.prospect_id, r.id);

  // matched_count suit le nombre de sollicitations envoyées.
  await admin
    .from("campaigns")
    .update({ matched_count: Number(camp.matched_count ?? 0) + added })
    .eq("id", campaignId);

  // ── Notifications (email + push) — fire-and-forget, parité avec le POST.
  const durationKey = t.durationKey ?? null;
  const isFlash = durationKey === "1h";
  const proName = pro?.raison_sociale ?? "Un professionnel";
  const proSector = pro?.secteur ?? null;

  void Promise.allSettled(
    matched
      .filter((m) => m.email)
      .map((m) =>
        sendRelationInvitation({
          email: m.email!,
          prenom: m.prenom,
          proName,
          proSector,
          motif,
          brief: motif,
          rewardEur: rewardCents(m) / 100,
          rewardDoubled: m.verification === "certifie_confiance",
          expiresAt,
          relationId: relIdByProspect.get(m.prospectId) ?? null,
        }),
      ),
  );

  void (async () => {
    try {
      const prospectIds = matched.map((m) => m.prospectId);
      const { data: pRows } = await admin
        .from("prospects")
        .select("id, clerk_user_id")
        .in("id", prospectIds);
      const clerkByProspect = new Map<string, string>();
      for (const r of pRows ?? []) {
        if (r.clerk_user_id) clerkByProspect.set(r.id, r.clerk_user_id);
      }
      const clerkIds = [...new Set([...clerkByProspect.values()])];
      if (clerkIds.length === 0) return;
      const { data: tokens } = await admin
        .from("push_tokens")
        .select("user_id, expo_token")
        .in("user_id", clerkIds);
      const tokensByClerk = new Map<string, string[]>();
      for (const row of tokens ?? []) {
        const list = tokensByClerk.get(row.user_id) ?? [];
        list.push(row.expo_token);
        tokensByClerk.set(row.user_id, list);
      }
      const messages: ExpoPushMessage[] = [];
      for (const m of matched) {
        const clerk = clerkByProspect.get(m.prospectId);
        if (!clerk) continue;
        const userTokens = tokensByClerk.get(clerk) ?? [];
        const relationId = relIdByProspect.get(m.prospectId);
        if (!relationId) continue;
        const rewardEur = rewardCents(m) / 100;
        for (const token of userTokens) {
          messages.push(
            isFlash
              ? buildFlashPayload({ token, proName, rewardEur, relationId, campaignId })
              : buildClassicPayload({ token, proName, rewardEur, durationKey: durationKey ?? "24h", relationId }),
          );
        }
      }
      if (messages.length > 0) await sendBatch(admin, messages);
    } catch (e) {
      console.error("[resolicit] push failed", e);
    }
  })();

  return { added };
}
