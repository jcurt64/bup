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
import { refCodeFromEmail } from "@/lib/waitlist/ref-code";

export const runtime = "nodejs";

const REFERRER_CAP = 10;

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

  // Récupère la row waitlist correspondant à l'email (insensible à la
  // casse). Si l'utilisateur s'est inscrit sur la liste d'attente, sa
  // row contient son `ref_code` persisté ; sinon on retombe sur le code
  // dérivé de l'email (l'algo est déterministe et identique côté client).
  const { data: row } = await supabase
    .from("waitlist")
    .select("ref_code")
    .ilike("email", email)
    .maybeSingle();

  const refCode = row?.ref_code ?? refCodeFromEmail(email);

  const { data: filleuls } = await supabase
    .from("waitlist")
    .select("prenom, nom, ville, created_at")
    .eq("referrer_ref_code", refCode)
    .order("created_at", { ascending: false });

  const list = filleuls ?? [];

  return NextResponse.json({
    refCode,
    cap: REFERRER_CAP,
    count: list.length,
    remaining: Math.max(0, REFERRER_CAP - list.length),
    filleuls: list.map((f) => ({
      prenom: f.prenom,
      nom: f.nom,
      ville: f.ville,
      createdAt: f.created_at,
    })),
  });
}
