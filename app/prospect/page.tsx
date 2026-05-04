/**
 * /prospect — espace prospect.
 *
 * 1. Vérifie l'auth Clerk (sinon le proxy redirige vers /connexion)
 * 2. Garantit qu'une row `prospects` existe pour cet utilisateur
 *    (filet de sécurité au cas où le webhook Clerk → Supabase serait en retard)
 * 3. Lit la row via un client Supabase qui propage le JWT Clerk → vérifie
 *    que les RLS répondent bien
 * 4. Rend l'iframe du prototype existant
 */

import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import PrototypeFrame from "../_components/PrototypeFrame";

export const metadata = {
  title: "BUUPP — Espace Prospect",
};

export default async function ProspectPage() {
  const { userId } = await auth();
  if (!userId) {
    // Le proxy.ts protège déjà cette route, mais TS ne le sait pas.
    throw new Error("Auth required");
  }

  const user = await currentUser();
  const primary = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  );

  // (2) Crée la row si absente — idempotent, utilise le service_role.
  await ensureProspect({
    clerkUserId: userId,
    email: primary?.emailAddress ?? null,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });

  // (3) Lecture via le client RLS — doit retourner exactement 1 row.
  const supabase = await createSupabaseServerClient();
  const { data: prospect, error } = await supabase
    .from("prospects")
    .select("id, bupp_score, verification, created_at")
    .single();

  if (error) {
    // Log côté serveur pour debug (visible dans `npm run dev`).
    console.error("[/prospect] Lecture RLS échouée :", error);
  } else {
    console.log("[/prospect] Pont Clerk↔Supabase OK → prospect", prospect.id);
  }

  return <PrototypeFrame route="prospect" />;
}
