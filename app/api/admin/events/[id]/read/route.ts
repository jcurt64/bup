/**
 * POST /api/admin/events/:id/read — marque l'event comme lu pour l'admin courant.
 *
 * Lecture-merge-écriture du JSONB `read_by` : suffisant pour 1 user qui se
 * marque lui-même (pas de race critique inter-users). Garde admin standard.
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/admin/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin.from("admin_events").select("read_by").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const next = { ...(row.read_by as Record<string, string>), [userId]: new Date().toISOString() };
  const { error } = await admin.from("admin_events").update({ read_by: next }).eq("id", id);
  if (error) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
