/**
 * /api/pro/freebuupps
 *  - POST : crée un FREEBUUPP (débit 10 € wallet, seed_hash, code, closes_at +24h).
 *  - GET  : liste les FREEBUUPP du pro (+ participantCount + statut effectif).
 *
 * Service_role : la lecture des participants croise plusieurs prospects.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { FREEBUUPP_FEE_CENTS } from "@/lib/freebuupp/pricing";
import { generateSeed, hashSeed } from "@/lib/freebuupp/draw";
import { PANEL_SIZES, WINNERS_COUNTS } from "@/lib/freebuupp/types";

export const runtime = "nodejs";

const ALLOWED_GEO = ["ville", "dept", "region", "national"] as const;
const TWENTY_FOUR_H_MS = 24 * 3600 * 1000;

function fbCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `FB-${s}`;
}

type Body = {
  title?: string;
  prizeDescription?: string;
  panelSize?: number;
  winnersCount?: number;
  geo?: string;
  geoTarget?: unknown;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const prize = (body.prizeDescription ?? "").trim();
  const panel = Number(body.panelSize);
  const winners = Number(body.winnersCount);
  if (
    !title ||
    !prize ||
    !PANEL_SIZES.includes(panel as 30) ||
    !WINNERS_COUNTS.includes(winners as 2) ||
    winners >= panel
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const geo = (ALLOWED_GEO as readonly string[]).includes(body.geo ?? "")
    ? (body.geo as string)
    : "national";

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  const admin = createSupabaseAdminClient();

  const { data: pro } = await admin
    .from("pro_accounts")
    .select("wallet_balance_cents, wallet_reserved_cents, raison_sociale, ville")
    .eq("id", proId)
    .single();
  if (!pro) return NextResponse.json({ error: "pro_not_found" }, { status: 404 });

  // Garde-fou : raison sociale + ville requises (sinon affichage public anonyme).
  const rawRaison = (pro.raison_sociale ?? "").trim();
  const hasRaison = rawRaison.length > 0 && !rawRaison.includes("@");
  const hasVille = !!(pro.ville ?? "").trim();
  if (!hasRaison || !hasVille) {
    return NextResponse.json(
      {
        error: "missing_company_info",
        message: "Renseignez votre raison sociale et votre ville avant de lancer un FREEBUUPP.",
        missing: { raisonSociale: !hasRaison, ville: !hasVille },
      },
      { status: 422 },
    );
  }

  const available =
    Number(pro.wallet_balance_cents) - Number(pro.wallet_reserved_cents ?? 0);
  if (available < FREEBUUPP_FEE_CENTS) {
    return NextResponse.json(
      { error: "insufficient_funds", walletAvailableCents: available, neededCents: FREEBUUPP_FEE_CENTS },
      { status: 402 },
    );
  }

  const seed = generateSeed();
  const { data: fb, error } = await admin
    .from("freebuupps")
    .insert({
      pro_account_id: proId,
      code: fbCode(),
      title,
      prize_description: prize,
      brand_name: rawRaison,
      panel_size: panel,
      winners_count: winners,
      geo,
      geo_target: (body.geoTarget ?? null) as never,
      status: "open",
      seed_hash: hashSeed(seed),
      seed,
      opens_at: new Date().toISOString(),
      closes_at: new Date(Date.now() + TWENTY_FOUR_H_MS).toISOString(),
      fee_cents: FREEBUUPP_FEE_CENTS,
    })
    .select("id, code")
    .single();
  if (error || !fb) {
    console.error("[/api/pro/freebuupps] insert failed", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // Débit immédiat des 10 € (frais forfaitaire, pas de réservation).
  await admin
    .from("pro_accounts")
    .update({ wallet_balance_cents: Number(pro.wallet_balance_cents) - FREEBUUPP_FEE_CENTS })
    .eq("id", proId);
  await admin.from("transactions").insert({
    account_id: proId,
    account_kind: "pro",
    type: "buupp_commission",
    status: "completed",
    amount_cents: -FREEBUUPP_FEE_CENTS,
    freebuupp_id: fb.id,
    description: `FREEBUUPP — ${title}`,
  });

  // Auto-recharge off-session si le solde passe sous le seuil (non bloquant).
  void (async () => {
    try {
      const { maybeTriggerAutoRecharge } = await import("@/lib/stripe/auto-recharge");
      await maybeTriggerAutoRecharge(proId);
    } catch (e) {
      console.warn("[freebuupp] auto-recharge non-blocking", e);
    }
  })();

  return NextResponse.json({ id: fb.id, code: fb.code });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  const admin = createSupabaseAdminClient();

  const { data: rows } = await admin
    .from("freebuupps")
    .select(
      "id, code, title, prize_description, panel_size, winners_count, status, opens_at, closes_at, drawn_at, geo",
    )
    .eq("pro_account_id", proId)
    .order("created_at", { ascending: false });

  const ids = (rows ?? []).map((r) => r.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: parts } = await admin
      .from("freebuupp_participants")
      .select("freebuupp_id")
      .in("freebuupp_id", ids);
    for (const p of parts ?? []) {
      counts.set(p.freebuupp_id, (counts.get(p.freebuupp_id) ?? 0) + 1);
    }
  }
  const now = Date.now();
  const freebuupps = (rows ?? []).map((r) => ({
    ...r,
    participantCount: counts.get(r.id) ?? 0,
    effectiveStatus:
      r.status === "open" && new Date(r.closes_at).getTime() <= now ? "closed" : r.status,
  }));
  return NextResponse.json({ freebuupps });
}
