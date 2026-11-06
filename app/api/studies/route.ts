/**
 * GET /api/studies — liste publique des campagnes Tests & Études.
 * Filtres : department, type, minReward (euros), deadlineBefore (ISO).
 * Visible sans compte. Les transitions échues sont appliquées en arrière-plan.
 */
import { NextResponse, after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { listPublicStudies } from "@/lib/studies/repo";
import { sweepStudies } from "@/lib/studies/sweep";
import { studiesDisabledResponse } from "@/lib/studies/http";
import { STUDY_TYPES } from "@/lib/studies/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const off = await studiesDisabledResponse();
  if (off) return off;
  const u = new URL(req.url);
  const type = u.searchParams.get("type");
  const minReward = Number(u.searchParams.get("minReward") ?? "");
  const admin = createSupabaseAdminClient();
  const items = await listPublicStudies(admin, {
    department: u.searchParams.get("department")?.toUpperCase() || null,
    type: type && (STUDY_TYPES as readonly string[]).includes(type) ? type : null,
    minRewardCents: Number.isFinite(minReward) && minReward > 0 ? Math.round(minReward * 100) : null,
    deadlineBefore: u.searchParams.get("deadlineBefore") || null,
  });
  after(() => sweepStudies(admin, items.map((i) => i.id)).then(() => undefined));
  return NextResponse.json({ items });
}
