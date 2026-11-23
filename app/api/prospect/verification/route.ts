/**
 * GET /api/prospect/verification — recalcule et persiste le palier de
 * vérification du prospect connecté (modèle 3 paliers).
 *
 *   basique             : par défaut à la création (toujours OK).
 *   verifie             : téléphone vérifié par SMS (Brevo).
 *   certifie_confiance  : un pro a validé une mise en relation effective, ou
 *                         une participation Tests & Études a été approuvée
 *                         (cf. lib/prospect/verification-tier).
 *
 * Le calcul est fait à chaque GET puis écrit dans `prospects.verification`
 * (idempotent, négligeable en coût). Le client peut ainsi afficher la
 * valeur la plus fraîche sans dépendre de triggers ou de jobs CRON.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import { recomputeVerificationTier } from "@/lib/prospect/verification-tier";

export const runtime = "nodejs";

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

  const [{ tier, signals }, ribRes] = await Promise.all([
    recomputeVerificationTier(admin, prospectId),
    admin
      .from("prospect_rib")
      .select("prospect_id, validated_at, iban, bic, holder_name")
      .eq("prospect_id", prospectId)
      .maybeSingle(),
  ]);

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
    // Nombre de mises en relation validées par un pro (+ études approuvées).
    // Clé historique conservée pour l'app mobile publiée.
    physicalAcceptances: signals.proValidations + signals.approvedStudies,
    proValidations: signals.proValidations,
    approvedStudies: signals.approvedStudies,
    progress:
      tier === "basique" ? 33
      : tier === "verifie" ? 66
      : 100,
  });
}
