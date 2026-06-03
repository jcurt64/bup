/**
 * GET /api/campaign/[id]/visit — « La Vitrine ».
 *
 * Lien de redirection tracké affiché sur l'annonce côté prospect. Enregistre
 * un clic (1 distinct par prospect via la contrainte unique de
 * campaign_website_clicks) puis redirige 302 vers le site web du pro.
 *
 * - La redirection ne s'effectue QUE vers `campaigns.website_url` (URL https
 *   validée à la création), jamais vers un paramètre client → pas d'open
 *   redirect.
 * - L'enregistrement du clic est best-effort : il n'a lieu que pour un
 *   prospect authentifié possédant une relation sur la campagne (le lien
 *   n'est montré qu'à eux), et toute erreur reste silencieuse pour ne jamais
 *   casser la redirection.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: camp } = await admin
    .from("campaigns")
    .select("id, website_url")
    .eq("id", id)
    .single();
  if (!camp || !camp.website_url) {
    return NextResponse.json({ error: "no_website" }, { status: 404 });
  }

  // Enregistre le clic si un prospect authentifié possède bien une relation
  // sur cette campagne. Best-effort : une erreur ne casse jamais la redirection.
  try {
    const { userId } = await auth();
    if (userId) {
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
      const { data: rel } = await admin
        .from("relations")
        .select("id")
        .eq("campaign_id", id)
        .eq("prospect_id", prospectId)
        .limit(1)
        .maybeSingle();
      if (rel) {
        // Upsert idempotent : 1 clic distinct par (campagne, prospect).
        await admin
          .from("campaign_website_clicks")
          .upsert(
            { campaign_id: id, prospect_id: prospectId },
            { onConflict: "campaign_id,prospect_id", ignoreDuplicates: true },
          );
      }
    }
  } catch (err) {
    console.error("[/api/campaign/visit] click record failed (non-blocking)", err);
  }

  return NextResponse.redirect(camp.website_url, 302);
}
