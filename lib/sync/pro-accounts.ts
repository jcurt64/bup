/**
 * Synchronisation Clerk ↔ Supabase pour les comptes professionnels.
 *
 * Symétrique de `lib/sync/prospects.ts` côté pro. Une row `pro_accounts`
 * doit exister pour chaque utilisateur Clerk côté pro avant tout flux
 * Stripe (les Checkout Sessions sont rattachées au `stripe_customer_id`
 * persisté ici, qui sert de clé de réutilisation entre rechargements).
 *
 * `raison_sociale` est obligatoire en base. À la création défensive (i.e.
 * webhook Clerk pas encore arrivé), on retombe sur l'email du compte
 * comme placeholder ; l'utilisateur pourra l'éditer ensuite via
 * "Mes informations".
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type EnsureProInput = {
  clerkUserId: string;
  email?: string | null;
  raisonSociale?: string | null;
};

export async function ensureProAccount(input: EnsureProInput): Promise<string> {
  const admin = createSupabaseAdminClient();

  const { data: existing, error: lookupError } = await admin
    .from("pro_accounts")
    .select("id")
    .eq("clerk_user_id", input.clerkUserId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing.id;

  const fallbackName =
    input.raisonSociale?.trim() ||
    input.email?.trim() ||
    "Compte pro (à compléter)";

  const { data: created, error: insertError } = await admin
    .from("pro_accounts")
    .insert({
      clerk_user_id: input.clerkUserId,
      raison_sociale: fallbackName,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  void (async () => {
    const { recordEvent } = await import("@/lib/admin/events/record");
    await recordEvent({
      type: "pro.signup",
      proAccountId: created.id,
      payload: { email: input.email ?? null },
    });
  })();

  return created.id;
}
