/**
 * GET /api/pro/campaigns/[id]/audience — distributions agrégées (facettes)
 * des contacts ayant accepté la campagne, pour l'atelier de segmentation.
 * Gating identique aux contacts : pro propriétaire + campagne `completed`.
 * Ne renvoie AUCUNE donnée brute (que des comptages) → neutre côté exfil.
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";
import { loadCampaignAudience } from "@/lib/pro/segmentation/load";
import { buildFacets } from "@/lib/pro/segmentation/facets";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_campaign_id" }, { status: 400 });

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const audience = await loadCampaignAudience(admin as unknown as import("@supabase/supabase-js").SupabaseClient, id);
  if (!audience || audience.proAccountId !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!proCanSeeContacts(audience.status)) {
    return NextResponse.json({ error: "campaign_not_closed" }, { status: 403 });
  }

  const facets = buildFacets(audience.contacts, audience.allowedTiers);

  const { data: segs } = await (admin as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("pro_segments")
    .select("id, name, filters, created_at")
    .eq("pro_account_id", proId)
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    total: audience.contacts.length,
    availableTiers: audience.allowedTiers,
    facets,
    savedSegments: segs ?? [],
  });
}
