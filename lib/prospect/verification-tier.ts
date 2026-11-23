/**
 * Niveau de vérification du prospect (3 niveaux) — source unique.
 *
 *   basique            : par défaut à la création du compte.
 *   verifie            : téléphone vérifié par SMS.
 *   certifie_confiance : un professionnel a confirmé qu'une mise en relation
 *                        a été EFFECTIVE (bouton « Valider la mise en
 *                        relation » sur la fiche prospect, après clôture de
 *                        la campagne → `relations.pro_validated_at`), OU une
 *                        participation Tests & Études a été approuvée par le
 *                        pro (le pro a validé qu'il a bien répondu).
 *
 * Remplace l'ancienne règle « rendez-vous physique accepté ».
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type VerificationTier = "basique" | "verifie" | "certifie_confiance";

export type TierSignals = {
  phoneVerified: boolean;
  proValidations: number;
  approvedStudies: number;
};

/** Règle pure (testable). */
export function tierFromSignals(s: TierSignals): VerificationTier {
  if (s.proValidations > 0 || s.approvedStudies > 0) return "certifie_confiance";
  if (s.phoneVerified) return "verifie";
  return "basique";
}

export async function readTierSignals(
  admin: SupabaseClient<Database>,
  prospectId: string,
): Promise<TierSignals> {
  const [identityRes, relRes, studyRes] = await Promise.all([
    admin
      .from("prospect_identity")
      .select("phone_verified_at")
      .eq("prospect_id", prospectId)
      .maybeSingle(),
    admin
      .from("relations")
      .select("id", { count: "exact", head: true })
      .eq("prospect_id", prospectId)
      .not("pro_validated_at", "is", null),
    admin
      .from("study_participations")
      .select("id", { count: "exact", head: true })
      .eq("prospect_id", prospectId)
      .eq("status", "approved"),
  ]);
  return {
    phoneVerified: Boolean(identityRes.data?.phone_verified_at),
    proValidations: relRes.count ?? 0,
    approvedStudies: studyRes.count ?? 0,
  };
}

/** Recalcule et persiste `prospects.verification` (UPDATE seulement si changé). */
export async function recomputeVerificationTier(
  admin: SupabaseClient<Database>,
  prospectId: string,
): Promise<{ tier: VerificationTier; signals: TierSignals }> {
  const signals = await readTierSignals(admin, prospectId);
  const tier = tierFromSignals(signals);
  const { data: current } = await admin
    .from("prospects")
    .select("verification")
    .eq("id", prospectId)
    .single();
  if ((current?.verification ?? "") !== tier) {
    await admin.from("prospects").update({ verification: tier }).eq("id", prospectId);
  }
  return { tier, signals };
}
