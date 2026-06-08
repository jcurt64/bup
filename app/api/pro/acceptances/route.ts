/**
 * GET /api/pro/acceptances?page=&size=
 *
 * Liste paginée de TOUTES les acceptations (relations status in
 * accepted | settled) du pro authentifié — alimente la modale « Voir
 * tout » de la section « Dernières acceptations » (Vue d'ensemble).
 *
 * L'endpoint /api/pro/overview ne renvoie que les 4 dernières ; ici on
 * pagine l'intégralité, trié par date de décision décroissante. Plafond
 * 50/page. Même masquage de nom que l'overview (RGPD : initiale du nom).
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { settleRipeRelationsAndNotify } from "@/lib/settle/ripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maskName(
  prenom: string | null | undefined,
  nom: string | null | undefined,
): string {
  const p = (prenom ?? "").trim();
  const n = (nom ?? "").trim();
  const nomMasked = n ? `${n.charAt(0).toUpperCase()}.` : "";
  const out = `${p} ${nomMasked}`.trim();
  return out || "Prospect anonyme";
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const size = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("size") ?? "25")),
  );

  const admin = createSupabaseAdminClient();
  try {
    await settleRipeRelationsAndNotify(admin);
  } catch (err) {
    console.error("[/api/pro/acceptances] lifecycle trigger failed", err);
  }
  const { data, error, count } = await admin
    .from("relations")
    .select(
      `id, status, reward_cents, decided_at,
       campaigns!inner ( name, status, targeting ),
       prospects:prospect_id ( bupp_score,
         prospect_identity ( prenom, nom )
       )`,
      { count: "exact" },
    )
    .eq("pro_account_id", proId)
    .in("status", ["accepted", "settled"])
    .eq("campaigns.status", "completed")
    .order("decided_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);

  if (error) {
    console.error("[/api/pro/acceptances] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type Row = {
    id: string;
    reward_cents: number;
    decided_at: string | null;
    campaigns: { name: string; status: string; targeting: { requiredTiers?: number[] } | null } | null;
    prospects: {
      bupp_score: number;
      prospect_identity: { prenom: string | null; nom: string | null } | null;
    } | null;
  };

  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const c = Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns;
    const id = Array.isArray(r.prospects) ? r.prospects[0] : r.prospects;
    const pi = id?.prospect_identity
      ? Array.isArray(id.prospect_identity)
        ? id.prospect_identity[0]
        : id.prospect_identity
      : null;
    const tiers = (c?.targeting?.requiredTiers ?? [1]) as number[];
    return {
      name: maskName(pi?.prenom, pi?.nom),
      score: id?.bupp_score ?? 0,
      campaign: c?.name ?? "—",
      tier: Math.max(1, ...tiers.map((n) => Number(n) || 0)),
      receivedAt: r.decided_at,
      costCents: Number(r.reward_cents ?? 0),
    };
  });

  return NextResponse.json({ page, size, total: count ?? 0, rows });
}
