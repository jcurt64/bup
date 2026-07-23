/**
 * POST /api/prospect/founder-bonus/claim — déblocage du bonus fondateur
 * 5 € à l'initiative du prospect.
 *
 * Le déblocage n'est PAS automatique : quand les deux conditions sont
 * réunies (3 mois d'ancienneté du compte + au moins une sollicitation
 * acceptée), le bonus devient « débloquable » et le prospect le récupère
 * lui-même depuis son portefeuille.
 *
 * La RPC `claim_founder_signup_bonus` revérifie les conditions côté
 * serveur : le bouton de l'interface n'est jamais la source de vérité.
 * Elle est idempotente — un second appel ne recrédite pas, faute de ligne
 * `pending` restante, et renvoie alors `claimed: false`.
 *
 * Réponses :
 *   200 { claimed: true }             → 5,00 € crédités, désormais retirables.
 *   409 { error: "not_claimable" }    → conditions non réunies, ou déjà débloqué.
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const prospectId = await ensureProspect({
    clerkUserId: userId,
    email,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });

  const admin = createSupabaseAdminClient();
  const { data: claimed, error } = await admin.rpc("claim_founder_signup_bonus", {
    p_prospect_id: prospectId,
  });

  if (error) {
    console.error("[founder-bonus/claim] rpc failed", prospectId, error.message);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  if (claimed !== true) {
    // Conditions non réunies (délai non écoulé, aucune acceptation) ou
    // bonus déjà récupéré. Même réponse dans les deux cas : l'interface
    // recharge le portefeuille et affiche l'état réel.
    return NextResponse.json(
      {
        error: "not_claimable",
        message:
          "Ce bonus n'est pas encore débloquable, ou il l'a déjà été.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ claimed: true });
}
