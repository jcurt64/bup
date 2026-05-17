/**
 * GET /api/admin/stats/prospects/list
 *   ?page=&size=&q=&minScore=&maxScore=&verification=&founder=
 *   &ville=&days=&sort=
 *
 * Liste paginée des prospects avec champs résumés, filtrable par colonne :
 *   - `q`            : full-text simple prénom/nom/email/ville (ilike, post-filtre)
 *   - `ville`        : filtre serveur (ilike) sur la ville — inner join
 *   - `minScore`/`maxScore` : bornes du BUUPP score
 *   - `verification` : eq sur le statut de vérification
 *   - `founder`      : "true" / "false"
 *   - `days`         : inscrits dans les N derniers jours (created_at >= now-N j)
 *   - `sort`         : date_desc (défaut) | date_asc | score_desc | score_asc
 *
 * Le `total` renvoyé reflète tous les filtres SERVEUR (ville, score,
 * vérif, founder, days) → ex. « nb de prospects inscrits à Lyon sur les
 * 7 derniers jours ». Le post-filtre `q` n'est pas compté (best-effort
 * sur la page courante). `facets` agrège villes + statuts de vérif pour
 * peupler les menus déroulants côté UI. Plafond 50/page.
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/admin/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS = {
  date_desc: { col: "created_at", asc: false },
  date_asc: { col: "created_at", asc: true },
  score_desc: { col: "bupp_score", asc: false },
  score_asc: { col: "bupp_score", asc: true },
} as const;
type SortKey = keyof typeof SORTS;

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? "25")));
  const q = (url.searchParams.get("q") ?? "").trim();
  const ville = (url.searchParams.get("ville") ?? "").trim();
  const minScoreRaw = Number(url.searchParams.get("minScore") ?? "0");
  const minScore = Number.isNaN(minScoreRaw) ? 0 : minScoreRaw;
  const maxScoreParam = (url.searchParams.get("maxScore") ?? "").trim();
  const maxScore =
    maxScoreParam !== "" && !Number.isNaN(Number(maxScoreParam))
      ? Number(maxScoreParam)
      : null;
  const verification = url.searchParams.get("verification");
  const founder = url.searchParams.get("founder");
  const daysRaw = Number(url.searchParams.get("days") ?? "0");
  const days = Number.isNaN(daysRaw) || daysRaw <= 0 ? 0 : Math.floor(daysRaw);
  const sortKey = (url.searchParams.get("sort") ?? "date_desc") as SortKey;
  const sort = SORTS[sortKey] ?? SORTS.date_desc;

  const admin = createSupabaseAdminClient();

  // Inner join sur la localisation uniquement quand on filtre par ville
  // (sinon les prospects sans localisation seraient exclus à tort).
  const locEmbed = ville
    ? "prospect_localisation!inner(ville)"
    : "prospect_localisation(ville)";

  let query = admin
    .from("prospects")
    .select(
      `id, bupp_score, verification, is_founder, created_at, prospect_identity(prenom, nom, email), ${locEmbed}`,
      { count: "exact" },
    )
    .gte("bupp_score", minScore)
    .order(sort.col, { ascending: sort.asc })
    .range((page - 1) * size, page * size - 1);

  if (maxScore != null) query = query.lte("bupp_score", maxScore);
  if (verification) query = query.eq("verification", verification as never);
  if (founder === "true") query = query.eq("is_founder", true);
  if (founder === "false") query = query.eq("is_founder", false);
  if (ville) query = query.ilike("prospect_localisation.ville", `%${ville}%`);
  if (days > 0) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("[/api/admin/stats/prospects/list] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  let rows = (data ?? []).map((r: any) => {
    const id = Array.isArray(r.prospect_identity)
      ? r.prospect_identity[0]
      : r.prospect_identity;
    const loc = Array.isArray(r.prospect_localisation)
      ? r.prospect_localisation[0]
      : r.prospect_localisation;
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

  // Facettes pour les menus déroulants (villes + statuts de vérif). Sur
  // page 1 uniquement : inutile de recalculer à chaque pagination, et
  // l'UI ne s'en sert que pour peupler les <select> au montage.
  let facets: { villes: string[]; verifications: string[] } | undefined;
  if (page === 1) {
    const [vRes, verRes] = await Promise.all([
      admin
        .from("prospect_localisation")
        .select("ville")
        .not("ville", "is", null)
        .limit(5000),
      admin.from("prospects").select("verification").limit(5000),
    ]);
    const villes = Array.from(
      new Set(
        (vRes.data ?? [])
          .map((r: any) => String(r.ville).trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "fr"));
    const verifications = Array.from(
      new Set(
        (verRes.data ?? []).map((r: any) => r.verification).filter(Boolean),
      ),
    ).sort((a: string, b: string) => a.localeCompare(b, "fr"));
    facets = { villes, verifications };
  }

  return NextResponse.json({ page, size, total: count ?? 0, rows, facets });
}
