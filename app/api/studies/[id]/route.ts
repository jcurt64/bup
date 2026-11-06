/**
 * GET /api/studies/:id — fiche publique d'une campagne (+ participation de
 * l'utilisateur connecté s'il est prospect : statut, code, lien/adresse).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getPublicStudy, prospectContext } from "@/lib/studies/repo";
import { sweepStudy } from "@/lib/studies/sweep";
import { studiesDisabledResponse, err } from "@/lib/studies/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const off = await studiesDisabledResponse();
  if (off) return off;
  const { id } = await ctx.params;
  const admin = createSupabaseAdminClient();
  if (/^[0-9a-f-]{36}$/i.test(id)) await sweepStudy(admin, id);
  const study = await getPublicStudy(admin, id);
  if (!study) return err("not_found", 404);

  let me: Record<string, unknown> | null = null;
  const { userId } = await auth();
  if (userId) {
    const pc = await prospectContext(admin, userId);
    if (pc) {
      const [{ data: part }, { data: report }] = await Promise.all([
        admin.from("study_participations")
          .select("id, status, code, done_at, rejected_at, reject_reason")
          .eq("campaign_id", id).eq("prospect_id", pc.prospectId).maybeSingle(),
        admin.from("study_reports").select("id").eq("campaign_id", id).eq("prospect_id", pc.prospectId).maybeSingle(),
      ]);
      let access: { externalUrl: string | null; address: string | null } | null = null;
      if (part && part.status !== "joined") {
        const { data: c } = await admin.from("study_campaigns").select("external_url, address").eq("id", id).single();
        access = { externalUrl: c?.external_url ?? null, address: c?.address ?? null };
      }
      me = {
        role: "prospect",
        eligibleZone: study.scope === "national" || pc.department === study.department,
        tier1Complete: Boolean(pc.prenom && pc.email),
        participation: part ?? null,
        access,
        reported: Boolean(report),
      };
    } else {
      me = { role: "other" };
    }
  }
  return NextResponse.json({ study, me });
}
