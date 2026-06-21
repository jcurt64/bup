/**
 * Bonus parrain v2 — calcul du « reach étendu ».
 *
 * À partir des prospects MATCHÉS d'une campagne (les parrains potentiels),
 * déduit les FILLEULS à solliciter en plus (même hors cible) :
 *   parrain matché → ses filleuls (waitlist.referrer_ref_code = ref_code du
 *   parrain) ayant un compte prospect.
 *
 * Déduplication : on exclut les filleuls déjà ciblés (déjà dans `matched`) et
 * les doublons (un filleul de plusieurs parrains n'est sollicité qu'une fois).
 * Plafonné à `maxExtra` relations supplémentaires.
 *
 * Lecture seule — l'appelant (POST /api/pro/campaigns) fait les INSERT.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type MatchedLite = { prospectId: string; email: string | null };

export type ReferralFilleul = {
  prospectId: string;
  email: string | null;
  prenom: string | null;
  clerkUserId: string | null;
  verification: "basique" | "verifie" | "certifie_confiance";
  /** prospect_id du parrain (matché) qui « amène » ce filleul. */
  parrainProspectId: string;
};

/** Variantes de casse pour les filtres `.in(email)` (waitlist/identity stockent
 *  parfois la casse d'origine ; le matching, du lowercase). */
function emailVariants(emails: string[]): string[] {
  const set = new Set<string>();
  for (const e of emails) {
    if (!e) continue;
    set.add(e);
    set.add(e.trim().toLowerCase());
  }
  return [...set];
}

export async function computeReferralReach(
  admin: SupabaseClient<Database>,
  opts: { matched: MatchedLite[]; maxExtra: number },
): Promise<{ filleuls: ReferralFilleul[]; parrainProspectIds: string[] }> {
  const { matched, maxExtra } = opts;
  if (maxExtra <= 0) return { filleuls: [], parrainProspectIds: [] };

  // emailLower → prospectId du parrain matché.
  const parrainByEmailLower = new Map<string, string>();
  const matchedProspectIds = new Set<string>();
  const matchedEmails: string[] = [];
  for (const m of matched) {
    matchedProspectIds.add(m.prospectId);
    if (!m.email) continue;
    const lower = m.email.trim().toLowerCase();
    if (!parrainByEmailLower.has(lower)) {
      parrainByEmailLower.set(lower, m.prospectId);
      matchedEmails.push(m.email);
    }
  }
  if (matchedEmails.length === 0) return { filleuls: [], parrainProspectIds: [] };

  // 1. ref_code de chaque parrain présent en waitlist.
  const { data: wlParrains } = await admin
    .from("waitlist")
    .select("email, ref_code")
    .in("email", emailVariants(matchedEmails));
  const refCodeToParrain = new Map<string, string>(); // ref_code → parrain prospectId
  for (const row of wlParrains ?? []) {
    const lower = (row.email ?? "").trim().toLowerCase();
    const parrainId = parrainByEmailLower.get(lower);
    if (parrainId && row.ref_code) refCodeToParrain.set(row.ref_code, parrainId);
  }
  if (refCodeToParrain.size === 0) return { filleuls: [], parrainProspectIds: [] };

  // 2. Filleuls : rows waitlist dont referrer_ref_code ∈ ref_codes des parrains.
  const { data: wlFilleuls } = await admin
    .from("waitlist")
    .select("email, referrer_ref_code")
    .in("referrer_ref_code", [...refCodeToParrain.keys()]);
  if (!wlFilleuls || wlFilleuls.length === 0) return { filleuls: [], parrainProspectIds: [] };

  // emailLower filleul → parrain prospectId (1er parrain rencontré).
  const filleulParrainByEmail = new Map<string, string>();
  const filleulEmails: string[] = [];
  for (const row of wlFilleuls) {
    const lower = (row.email ?? "").trim().toLowerCase();
    if (!lower || !row.referrer_ref_code) continue;
    const parrainId = refCodeToParrain.get(row.referrer_ref_code);
    if (!parrainId) continue;
    if (!filleulParrainByEmail.has(lower)) {
      filleulParrainByEmail.set(lower, parrainId);
      filleulEmails.push(row.email!);
    }
  }
  if (filleulEmails.length === 0) return { filleuls: [], parrainProspectIds: [] };

  // 3. Filleuls ayant un COMPTE prospect (sinon impossible de leur créer une
  //    relation). On joint identité → prospect (verification + clerk).
  const { data: idents } = await admin
    .from("prospect_identity")
    .select("email, prenom, prospect_id, prospects:prospect_id ( verification, clerk_user_id )")
    .in("email", emailVariants(filleulEmails));

  const filleuls: ReferralFilleul[] = [];
  const seen = new Set<string>();
  const parrainsWithFilleul = new Set<string>();
  for (const row of idents ?? []) {
    if (filleuls.length >= maxExtra) break;
    const lower = (row.email ?? "").trim().toLowerCase();
    const parrainId = filleulParrainByEmail.get(lower);
    if (!parrainId) continue;
    const prospectId = row.prospect_id as string | null;
    if (!prospectId) continue;
    // Dédup : déjà ciblé (matché) ou déjà ajouté.
    if (matchedProspectIds.has(prospectId) || seen.has(prospectId)) continue;
    // Un filleul ne peut pas être son propre parrain.
    if (prospectId === parrainId) continue;
    const p = Array.isArray(row.prospects) ? row.prospects[0] : row.prospects;
    seen.add(prospectId);
    filleuls.push({
      prospectId,
      email: row.email ?? null,
      prenom: row.prenom ?? null,
      clerkUserId: (p?.clerk_user_id as string | null) ?? null,
      verification: (p?.verification as ReferralFilleul["verification"]) ?? "basique",
      parrainProspectId: parrainId,
    });
    parrainsWithFilleul.add(parrainId);
  }

  return { filleuls, parrainProspectIds: [...parrainsWithFilleul] };
}
