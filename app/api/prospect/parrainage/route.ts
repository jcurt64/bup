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
import {
  VIP_FILLEUL_THRESHOLD,
  VIP_BUDGET_MIN_CENTS,
  VIP_FLAT_BONUS_CENTS,
} from "@/lib/founders";

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

  // Palier VIP : seuil à 10 filleuls (= cap). Le bonus exceptionnel
  // +5,00 € s'applique en lieu et place du ×2 fondateur, uniquement
  // sur les campagnes dont le budget total dépasse 300,00 €.
  // Le UI dashboard utilise ces 4 champs pour expliquer la mécanique.
  const vipEligible = list.length >= VIP_FILLEUL_THRESHOLD;

  return NextResponse.json({
    refCode,
    cap: REFERRER_CAP,
    count: list.length,
    remaining: Math.max(0, REFERRER_CAP - list.length),
    vipEligible,
    vipThreshold: VIP_FILLEUL_THRESHOLD,
    vipBudgetMinEur: VIP_BUDGET_MIN_CENTS / 100,
    vipFlatBonusEur: VIP_FLAT_BONUS_CENTS / 100,
    filleuls: list.map((f) => ({
      prenom: f.prenom,
      nom: f.nom,
      ville: f.ville,
      createdAt: f.created_at,
    })),
  });
}
