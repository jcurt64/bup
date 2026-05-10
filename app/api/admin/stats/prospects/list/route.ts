/**
 * GET /api/admin/stats/prospects/list?page=&size=&q=&minScore=&verification=&founder=
 *
 * Liste paginée des prospects avec champs résumés. `q` est appliqué en
 * full-text simple sur prénom/nom/email/ville (ilike). `founder` accepte
 * "true"/"false". Plafond 50/page pour limiter le coût.
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? "25")));
  const q = (url.searchParams.get("q") ?? "").trim();
  const minScore = Number(url.searchParams.get("minScore") ?? "0");
  const verification = url.searchParams.get("verification");
  const founder = url.searchParams.get("founder");

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("prospects")
    .select(
      "id, bupp_score, verification, is_founder, created_at, prospect_identity(prenom, nom, email), prospect_localisation(ville)",
      { count: "exact" },
    )
    .gte("bupp_score", isNaN(minScore) ? 0 : minScore)
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);

  if (verification) query = query.eq("verification", verification as never);
  if (founder === "true") query = query.eq("is_founder", true);
  if (founder === "false") query = query.eq("is_founder", false);

  const { data, error, count } = await query;
  if (error) {
    console.error("[/api/admin/stats/prospects/list] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  let rows = (data ?? []).map((r: any) => {
    const id = Array.isArray(r.prospect_identity) ? r.prospect_identity[0] : r.prospect_identity;
    const loc = Array.isArray(r.prospect_localisation) ? r.prospect_localisation[0] : r.prospect_localisation;
    return {
      id: r.id,
      score: r.bupp_score,
      verification: r.verification,
      founder: r.is_founder,
      createdAt: r.created_at,
      prenom: id?.prenom ?? null,
      nom: id?.nom ?? null,
      email: id?.email ?? null,
      ville: loc?.ville ?? null,
    };
  });

  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) =>
      [r.prenom, r.nom, r.email, r.ville]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle)),
    );
  }

  return NextResponse.json({ page, size, total: count ?? 0, rows });
}
