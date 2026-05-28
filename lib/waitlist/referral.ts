import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { refCodeFromEmail } from "@/lib/waitlist/ref-code";

export type ReferralBadgeTier = "cuivre" | "argent" | "or";

/**
 * Palier de badge couronne selon le nombre de filleuls.
 *   0      → null (pas de badge)
 *   1-2    → cuivre
 *   3-9    → argent
 *   10+    → or
 * (10 = cap waitlist ; >10 impossible via le trigger Postgres, mais on
 *  borne quand même pour robustesse d'affichage.)
 */
export function referralBadgeTier(count: number): ReferralBadgeTier | null {
  if (count >= 10) return "or";
  if (count >= 3) return "argent";
  if (count >= 1) return "cuivre";
  return null;
}

const REFERRER_CAP = 10;

export type ReferralStatus = {
  refCode: string;
  count: number;
  cap: number;
  remaining: number;
  badgeTier: ReferralBadgeTier | null;
  /** Rang d'inscription waitlist (1-based). null si l'e-mail n'est pas inscrit. */
  founderNumber: number | null;
  /** = présent dans la waitlist. Distinct de prospects.is_founder (cf. spec). */
  isFounder: boolean;
};

export async function getReferralStatus(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<ReferralStatus> {
  // 1. Row waitlist de l'utilisateur (insensible à la casse).
  const { data: row } = await admin
    .from("waitlist")
    .select("ref_code, created_at")
    .ilike("email", email)
    .maybeSingle();

  const refCode = row?.ref_code ?? refCodeFromEmail(email);
  const isFounder = !!row;

  // 2. Nombre de filleuls (count head, pas de payload).
  const { count: filleulCount } = await admin
    .from("waitlist")
    .select("id", { count: "exact", head: true })
    .eq("referrer_ref_code", refCode);

  const count = filleulCount ?? 0;

  // 3. Rang d'inscription (uniquement si inscrit). Rang = nb de rows
  //    inscrites à <= ma date de création.
  let founderNumber: number | null = null;
  if (row?.created_at) {
    const { count: rank } = await admin
      .from("waitlist")
      .select("id", { count: "exact", head: true })
      .lte("created_at", row.created_at);
    founderNumber = rank ?? null;
  }

  return {
    refCode,
    count,
    cap: REFERRER_CAP,
    remaining: Math.max(0, REFERRER_CAP - count),
    badgeTier: referralBadgeTier(count),
    founderNumber,
    isFounder,
  };
}
