/**
 * Synchronisation Clerk ↔ Supabase pour les prospects.
 *
 * Une row `prospects` doit exister pour CHAQUE utilisateur Clerk côté
 * particulier. Source de vérité : le webhook `user.created` côté Clerk.
 * Mais comme le webhook peut arriver avec un peu de retard, on fournit
 * aussi un upsert défensif appelé au premier accès au dashboard.
 */

import { nomInitial } from "@/lib/campaigns/contact-channels";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isTestEmail } from "@/lib/test-accounts";

export type EnsureProspectInput = {
  clerkUserId: string;
  email?: string | null;
  prenom?: string | null;
  nom?: string | null;
};

export async function ensureProspect(input: EnsureProspectInput) {
  const admin = createSupabaseAdminClient();

  const { data: existing, error: lookupError } = await admin
    .from("prospects")
    .select("id, is_test")
    .eq("clerk_user_id", input.clerkUserId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  const testAccount = isTestEmail(input.email);
  if (existing) {
    // Compte de test créé avant le marquage automatique → rattrapage.
    if (testAccount && !existing.is_test) {
      await admin.from("prospects").update({ is_test: true }).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error: insertError } = await admin
    .from("prospects")
    .insert({ clerk_user_id: input.clerkUserId, is_test: testAccount })
    .select("id")
    .single();

  if (insertError) throw insertError;

  // Pré-remplit le palier 1 si on a déjà des infos depuis Clerk.
  if (input.email || input.prenom || input.nom) {
    await admin.from("prospect_identity").insert({
      prospect_id: created.id,
      email: input.email ?? null,
      prenom: input.prenom ?? null,
      // Pivot « mise en relation pure » : seule l'initiale du nom est stockée.
      nom: nomInitial(input.nom),
    });
  }

  void (async () => {
    const { recordEvent } = await import("@/lib/admin/events/record");
    await recordEvent({
      type: "prospect.signup",
      prospectId: created.id,
    });
  })();

  return created.id;
}

export async function deleteProspect(clerkUserId: string) {
  const admin = createSupabaseAdminClient();
  // Le ON DELETE CASCADE des paliers gère la propagation.
  const { error } = await admin
    .from("prospects")
    .delete()
    .eq("clerk_user_id", clerkUserId);
  if (error) throw error;
}
