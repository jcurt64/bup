/**
 * Helpers fiscaux partagés entre /api/prospect/fiscal et les routes
 * /api/prospect/fiscal/[year]/{recap,dgfip-receipt}.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export const DGFIP_THRESHOLD_EUR = 3000;
export const DGFIP_THRESHOLD_TRANSACTIONS = 20;

export function yearBoundsIso(year: number): { startIso: string; endIso: string } {
  const startIso = new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString();
  const endIso = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)).toISOString();
  return { startIso, endIso };
}

export type FiscalYearTotals = {
  year: number;
  totalCents: number;
  transactionCount: number;
  reportedToDgfip: boolean;
};

export async function loadFiscalYear(
  admin: SupabaseClient<Database>,
  prospectId: string,
  year: number,
): Promise<FiscalYearTotals> {
  const { startIso, endIso } = yearBoundsIso(year);
  const [{ data: amounts }, { count }] = await Promise.all([
    admin
      .from("transactions")
      .select("amount_cents")
      .eq("account_kind", "prospect")
      .eq("account_id", prospectId)
      .in("type", ["credit", "referral_bonus"])
      .eq("status", "completed")
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("account_kind", "prospect")
      .eq("account_id", prospectId)
      .in("type", ["credit", "referral_bonus"])
      .eq("status", "completed")
      .gte("created_at", startIso)
      .lt("created_at", endIso),
  ]);

  const totalCents = (amounts ?? []).reduce(
    (acc, r) => acc + Number(r.amount_cents ?? 0),
    0,
  );
  const transactionCount = count ?? 0;
  const reportedToDgfip =
    totalCents >= DGFIP_THRESHOLD_EUR * 100 ||
    transactionCount >= DGFIP_THRESHOLD_TRANSACTIONS;

  return { year, totalCents, transactionCount, reportedToDgfip };
}

export type ProspectIdentityRow = {
  prenom: string | null;
  nom: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  codePostal: string | null;
};

export async function loadProspectFiscalIdentity(
  admin: SupabaseClient<Database>,
  prospectId: string,
): Promise<ProspectIdentityRow> {
  const [{ data: id }, { data: loc }] = await Promise.all([
    admin
      .from("prospect_identity")
      .select("prenom, nom, email")
      .eq("prospect_id", prospectId)
      .maybeSingle(),
    admin
      .from("prospect_localisation")
      .select("adresse, ville, code_postal")
      .eq("prospect_id", prospectId)
      .maybeSingle(),
  ]);
  return {
    prenom: id?.prenom ?? null,
    nom: id?.nom ?? null,
    email: id?.email ?? null,
    adresse: loc?.adresse ?? null,
    ville: loc?.ville ?? null,
    codePostal: loc?.code_postal ?? null,
  };
}
