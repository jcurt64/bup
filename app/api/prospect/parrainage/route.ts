/**
 * GET /api/prospect/parrainage — données du tab "Parrainage" du dashboard.
 *
 * Retourne :
 *   - le `refCode` unique de l'utilisateur (généré à son inscription
 *     sur la liste d'attente, depuis son email) ;
 *   - la liste des `filleuls` (inscrits ayant utilisé son code) ;
 *   - quelques compteurs agrégés (count, cap, places restantes).
 *
 * Auth : Clerk obligatoire. Le code est récupéré via l'email primaire
 * de l'utilisateur Clerk → join sur `waitlist.email`. Les lectures
 * passent par le client `service_role` car la table `waitlist` n'expose
 * aucune policy RLS.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getReferralStatus } from "@/lib/waitlist/referral";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress;

  if (!email) {
    return NextResponse.json(
      { error: "no_email", message: "Compte sans adresse e-mail primaire." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const status = await getReferralStatus(supabase, email);

  const [filleulsRes, configRes] = await Promise.all([
    // Liste des filleuls : toujours filtrée par le ref_code de l'utilisateur.
    supabase
      .from("waitlist")
      .select("prenom, nom, ville, created_at")
      .eq("referrer_ref_code", status.refCode)
      .order("created_at", { ascending: false }),
    supabase.from("app_config").select("launch_at").eq("id", true).maybeSingle(),
  ]);

  const list = filleulsRes.data ?? [];

  return NextResponse.json({
    refCode: status.refCode,
    launchAt: configRes.data?.launch_at ?? null,
    cap: status.cap,
    count: status.count,
    remaining: status.remaining,
    badgeTier: status.badgeTier,
    founderNumber: status.founderNumber,
    isFounder: status.isFounder,
    filleuls: list.map((f) => ({
      prenom: f.prenom,
      nom: f.nom,
      ville: f.ville,
      createdAt: f.created_at,
    })),
  });
}
