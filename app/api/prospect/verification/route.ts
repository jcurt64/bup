/**
 * GET /api/prospect/verification — recalcule et persiste le palier de
 * vérification du prospect connecté (modèle 3 paliers).
 *
 *   basique             : par défaut à la création (toujours OK).
 *   verifie             : téléphone vérifié par SMS (Brevo).
 *   certifie_confiance  : le prospect a accepté ≥ 1 mise en relation
 *                         issue d'une campagne de type 'prise_de_rendez_vous'.
 *
 * Le calcul est fait à chaque GET puis écrit dans `prospects.verification`
 * (idempotent, négligeable en coût). Le client peut ainsi afficher la
 * valeur la plus fraîche sans dépendre de triggers ou de jobs CRON.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const runtime = "nodejs";

type Tier = "basique" | "verifie" | "certifie_confiance";

export async function GET() {
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

  // Lectures parallèles : tél vérifié, RIB éventuel, relations physiques.
  const [identityRes, ribRes, rdvRes] = await Promise.all([
    admin
      .from("prospect_identity")
      .select("phone_verified_at")
      .eq("prospect_id", prospectId)
      .maybeSingle(),
    admin
      .from("prospect_rib")
      .select("prospect_id, validated_at, iban, bic, holder_name")
      .eq("prospect_id", prospectId)
      .maybeSingle(),
    // Une relation = "rendez-vous physique accepté" si :
    //   - status ∈ {accepted, settled}
    //   - la campagne associée a type = 'prise_de_rendez_vous'
    // Postgrest fait le join via le FK, count(*) côté client.
    admin
      .from("relations")
      .select("id, campaigns!inner(type)", { count: "exact" })
      .eq("prospect_id", prospectId)
      .in("status", ["accepted", "settled"])
      .eq("campaigns.type", "prise_de_rendez_vous"),
  ]);

  const hasPhoneVerified = Boolean(identityRes.data?.phone_verified_at);
  const hasPhysicalAcceptance = (rdvRes.count ?? 0) > 0;

  let tier: Tier = "basique";
  if (hasPhysicalAcceptance) tier = "certifie_confiance";
  else if (hasPhoneVerified) tier = "verifie";

  // Persiste si différent — évite des UPDATE inutiles à chaque fetch.
  const { data: current } = await admin
    .from("prospects")
    .select("verification")
    .eq("id", prospectId)
    .single();
  if ((current?.verification ?? "") !== tier) {
    await admin
      .from("prospects")
      .update({ verification: tier })
      .eq("id", prospectId);
  }

  return NextResponse.json({
    tier,
    rib: ribRes.data
      ? {
          // On ne renvoie jamais l'IBAN en clair entier — masque sauf 4
          // derniers chiffres pour respecter la pratique courante des
          // dashboards bancaires.
          ibanMasked:
            ribRes.data.iban.length > 4
              ? "•••• " + ribRes.data.iban.slice(-4)
              : ribRes.data.iban,
          bic: ribRes.data.bic,
          holderName: ribRes.data.holder_name,
          validated: Boolean(ribRes.data.validated_at),
          validatedAt: ribRes.data.validated_at,
        }
      : null,
    physicalAcceptances: rdvRes.count ?? 0,
    progress:
      tier === "basique" ? 33
      : tier === "verifie" ? 66
      : 100,
  });
}
