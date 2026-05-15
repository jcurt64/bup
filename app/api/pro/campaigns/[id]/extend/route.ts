/**
 * POST /api/pro/campaigns/:id/extend — prolonge UNE seule fois la durée
 * d'une campagne moyennant 10 € HT.
 *
 * Règles :
 *   - Pro propriétaire de la campagne uniquement.
 *   - Statut requis : 'active' ou 'paused' (non expirée).
 *   - `extension_used` doit être false.
 *   - Solde DISPONIBLE ≥ 10 € (= wallet_balance - wallet_reserved).
 *   - Durée ajoutée = durée originale lue depuis `targeting.durationKey`
 *     (1h, 24h, 48h, 7d). Cette même durée s'applique aux flash deals.
 *   - On ne crée PAS de nouvelle campagne : on décale `ends_at` sur la
 *     campagne existante. Les relations 'pending' bénéficient
 *     automatiquement de la fenêtre supplémentaire.
 *   - 10 € débités du wallet pro et tracés en transaction
 *     `buupp_commission` (revenu BUUPP non remboursable).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

const DURATION_MS: Record<string, number> = {
  "1h":  3600 * 1000,
  "24h": 24 * 3600 * 1000,
  "48h": 48 * 3600 * 1000,
  "7d":  7 * 24 * 3600 * 1000,
};

const EXTENSION_FEE_CENTS = 1000; // 10,00 € HT

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const { data: camp, error: readErr } = await admin
    .from("campaigns")
    .select(
      "id, status, ends_at, pro_account_id, targeting, extension_used, name",
    )
    .eq("id", id)
    .single();
  if (readErr || !camp) {
    return NextResponse.json({ error: "campaign_not_found" }, { status: 404 });
  }
  if (camp.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (camp.extension_used) {
    return NextResponse.json({ error: "extension_already_used" }, { status: 409 });
  }
  if (camp.status !== "active" && camp.status !== "paused") {
    return NextResponse.json(
      { error: "campaign_not_extendable", status: camp.status },
      { status: 409 },
    );
  }
  if (!camp.ends_at) {
    return NextResponse.json({ error: "no_ends_at" }, { status: 500 });
  }
  if (new Date(camp.ends_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "campaign_expired" }, { status: 410 });
  }

  const targeting = (camp.targeting as { durationKey?: string } | null) ?? null;
  const durationKey = targeting?.durationKey ?? null;
  const extensionMs = durationKey ? DURATION_MS[durationKey] : null;
  if (!extensionMs) {
    return NextResponse.json(
      { error: "unknown_duration", durationKey },
      { status: 400 },
    );
  }

  // Solde disponible (= balance - réservé) : on ne pioche pas dans
  // l'argent déjà engagé sur d'autres campagnes actives.
  const { data: pro } = await admin
    .from("pro_accounts")
    .select("wallet_balance_cents, wallet_reserved_cents")
    .eq("id", proId)
    .single();
  if (!pro) {
    return NextResponse.json({ error: "pro_not_found" }, { status: 404 });
  }
  const balance = Number(pro.wallet_balance_cents ?? 0);
  const reserved = Number(pro.wallet_reserved_cents ?? 0);
  const available = Math.max(0, balance - reserved);
  if (available < EXTENSION_FEE_CENTS) {
    return NextResponse.json(
      {
        error: "insufficient_funds",
        walletAvailableCents: available,
        neededCents: EXTENSION_FEE_CENTS,
      },
      { status: 402 },
    );
  }

  // Décale `ends_at`, flag `extension_used` (TOCTOU sur extension_used).
  const newEndsAt = new Date(
    new Date(camp.ends_at).getTime() + extensionMs,
  ).toISOString();
  const nowIso = new Date().toISOString();
  const { error: updErr } = await admin
    .from("campaigns")
    .update({
      ends_at: newEndsAt,
      extension_used: true,
      extension_paid_cents: EXTENSION_FEE_CENTS,
      extended_at: nowIso,
    })
    .eq("id", id)
    .eq("extension_used", false);
  if (updErr) {
    console.error("[/api/pro/campaigns/extend] update failed", updErr);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // Débit wallet pro + transaction (revenu BUUPP, non lié aux acceptations).
  const { error: walletErr } = await admin
    .from("pro_accounts")
    .update({ wallet_balance_cents: balance - EXTENSION_FEE_CENTS })
    .eq("id", proId);
  if (walletErr) {
    console.error("[/api/pro/campaigns/extend] wallet debit failed", walletErr);
    // Best-effort rollback du flag (sans la durée, le pro pourrait
    // re-prolonger gratuitement) — on revient en état initial.
    await admin
      .from("campaigns")
      .update({
        ends_at: camp.ends_at,
        extension_used: false,
        extension_paid_cents: 0,
        extended_at: null,
      })
      .eq("id", id);
    return NextResponse.json({ error: "wallet_debit_failed" }, { status: 500 });
  }

  await admin.from("transactions").insert({
    account_id: proId,
    account_kind: "pro",
    type: "buupp_commission",
    status: "completed",
    amount_cents: -EXTENSION_FEE_CENTS,
    campaign_id: id,
    description: `Prolongation campagne (${durationKey}) — 10 € HT`,
  });

  // Auto-recharge : déclenche un PaymentIntent off-session si le solde
  // est désormais sous le seuil configuré par le pro. Fire-and-forget,
  // n'impacte pas la réponse API si Stripe est lent ou échoue.
  void (async () => {
    try {
      const { maybeTriggerAutoRecharge } = await import("@/lib/stripe/auto-recharge");
      await maybeTriggerAutoRecharge(proId);
    } catch (err) {
      console.warn("[extend] auto-recharge trigger failed (non-blocking)", err);
    }
  })();

  return NextResponse.json({
    ok: true,
    campaignId: id,
    durationKey,
    extensionMs,
    newEndsAt,
    feeCents: EXTENSION_FEE_CENTS,
  });
}
