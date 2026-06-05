/**
 * POST /api/prospect/relations/[id]/decision
 * Body : { action: 'accept' | 'refuse' | 'undo' }
 *
 * Transitions autorisées :
 *   accept : pending  → accepted   (RPC accept_relation_tx, atomique)
 *   refuse : pending  → refused    (update simple, pas d'effet financier)
 *   refuse : accepted → refused    (RPC refund_relation_tx + status=refused)
 *   undo   : refused  → pending    (update simple)
 *   undo   : accepted → pending    (RPC refund_relation_tx + status=pending)
 *
 * Toutes les vérifications (ownership, expiration, statut campagne, solde
 * du pro) sont faites côté SQL — la RPC raise une exception nommée si
 * la transition est invalide. On mappe ces codes en réponses HTTP.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendRelationAccepted } from "@/lib/email/relation-accepted";
import { sendRelationRefused } from "@/lib/email/relation-refused";
import {
  TIER_NUM_TO_KEY,
  missingRequiredTierNums,
  normalizeRequiredTierNums,
  tierTable,
} from "@/lib/prospect/completeness";
import type { TierKey } from "@/lib/prospect/donnees";
import {
  acceptRestrictedMessage,
  liftExpiredNonResponseRestriction,
} from "@/lib/prospect/non-response";

// Anti-spam / anti-DDoS : un utilisateur ne peut prendre qu'une seule
// décision (accept/refuse/undo) toutes les 5 minutes — fenêtre glissante
// fixed-window via la table rate_limits. Le client (modale flash deal /
// onglet Mises en relation) traduit le 429 en message lisible avec
// countdown. Fail-open côté `checkRateLimit` si la base est down.
const DECISION_LIMIT = 1;
const DECISION_WINDOW_SEC = 5 * 60;

function formatRetryAfter(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} s`;
  if (r === 0) return `${m} min`;
  return `${m} min ${r} s`;
}

export const runtime = "nodejs";

type Action = "accept" | "refuse" | "undo";

type RouteContext = { params: Promise<{ id: string }> };

const ACTION_TO_ERROR_HTTP: Record<string, number> = {
  relation_not_found: 404,
  invalid_status: 409,
  campaign_inactive: 409,
  campaign_expired: 410,
  relation_expired: 410,
  insufficient_pro_funds: 402,
  not_accepted: 409,
  invalid_target_status: 400,
};

export async function POST(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let body: { action?: Action };
  try {
    body = (await req.json()) as { action?: Action };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const action = body.action;
  if (!action || !["accept", "refuse", "undo"].includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Ownership check : la relation doit appartenir au prospect courant.
  // On charge aussi le ciblage de la campagne (requiredTiers) pour le
  // garde-fou « données complètes » appliqué à l'acceptation.
  const { data: rel, error: relErr } = await admin
    .from("relations")
    .select(
      "id, status, prospect_id, prospects:prospect_id(clerk_user_id, accept_restricted_until), campaigns(targeting)",
    )
    .eq("id", id)
    .single();
  if (relErr || !rel) {
    return NextResponse.json({ error: "relation_not_found" }, { status: 404 });
  }
  const prospectRow = (
    Array.isArray(rel.prospects) ? rel.prospects[0] : rel.prospects
  ) as { clerk_user_id?: string; accept_restricted_until?: string | null } | null;
  const ownerClerkId = prospectRow?.clerk_user_id;
  if (ownerClerkId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Restriction « non-réponse » (cf. lib/prospect/non-response.ts) : un prospect
  // ayant accumulé 4 strikes ne peut plus accepter pendant 2 mois. On lève
  // d'abord paresseusement une restriction échue (ardoise propre), sinon on
  // bloque l'acceptation avec un message courtois. Placé AVANT le garde
  // « données complètes » et le rate-limit (un refus pour restriction ne doit
  // consommer aucun quota).
  if (action === "accept") {
    const restrictedUntil = prospectRow?.accept_restricted_until ?? null;
    if (restrictedUntil) {
      const wasReset = await liftExpiredNonResponseRestriction(admin, rel.prospect_id, {
        accept_restricted_until: restrictedUntil,
        clerk_user_id: ownerClerkId ?? null,
      });
      if (!wasReset) {
        return NextResponse.json(
          {
            error: "accept_restricted",
            restrictedUntil,
            message: acceptRestrictedMessage(restrictedUntil),
          },
          { status: 403 },
        );
      }
    }
  }

  // Garde-fou « données complètes » — backstop du contrôle client (cf.
  // Prospect.jsx). Pour ACCEPTER, le prospect doit avoir intégralement
  // renseigné tous les paliers exigés par la campagne. Vérifié AVANT le
  // rate-limit : une acceptation bloquée pour palier incomplet ne doit
  // pas consommer le quota de 5 min (sinon le prospect, après avoir
  // complété ses infos, devrait attendre pour ré-accepter).
  if (action === "accept") {
    const campRaw = Array.isArray(rel.campaigns)
      ? rel.campaigns[0]
      : rel.campaigns;
    const targeting = (campRaw?.targeting ?? null) as Record<string, unknown> | null;
    const requiredNums = normalizeRequiredTierNums(targeting?.requiredTiers);
    const requiredKeys = requiredNums
      .map((n) => TIER_NUM_TO_KEY[n])
      .filter(Boolean) as TierKey[];
    const rows: Partial<Record<TierKey, Record<string, unknown> | null>> = {};
    await Promise.all(
      requiredKeys.map(async (key) => {
        const { data } = await admin
          .from(tierTable(key))
          .select("*")
          .eq("prospect_id", rel.prospect_id)
          .maybeSingle();
        rows[key] = (data as Record<string, unknown> | null) ?? null;
      }),
    );
    const missingTiers = missingRequiredTierNums(requiredNums, rows);
    if (missingTiers.length > 0) {
      return NextResponse.json(
        {
          error: "tiers_incomplete",
          missingTiers,
          message:
            "Merci de renseigner l'intégralité des informations demandées pour accepter cette sollicitation.",
        },
        { status: 422 },
      );
    }
  }

  // Rate limit anti-spam : 1 décision / 5 min / (user × relation).
  // Le quota est INDÉPENDANT par sollicitation — un accept sur la
  // relation A n'épuise PAS la fenêtre sur la relation B. La key inclut
  // donc l'id de relation pour scoper le compteur.
  const limit = await checkRateLimit({
    key: `relation-decision:${userId}:${id}`,
    limit: DECISION_LIMIT,
    windowSec: DECISION_WINDOW_SEC,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          `Pas trop vite 😊 vous pouvez accepter ou refuser cette sollicitation qu'une fois toutes les 5 minutes. Réessayez dans ${formatRetryAfter(limit.retryAfterSec)}.`,
        retryAfterSec: limit.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  try {
    if (action === "accept") {
      const { error } = await admin.rpc("accept_relation_tx", { p_relation_id: id });
      if (error) return mapRpcError(error);
    } else if (action === "refuse") {
      if (rel.status === "accepted" || rel.status === "settled") {
        const { error } = await admin.rpc("refund_relation_tx", {
          p_relation_id: id,
          p_new_status: "refused",
        });
        if (error) return mapRpcError(error);
      } else if (rel.status === "pending") {
        // Garde TOCTOU : si le status a changé entre notre SELECT et l'UPDATE
        // (ex. parallel `accept` qui a déjà escrow l'argent), l'UPDATE doit
        // affecter 0 row et on renvoie 409 — sinon le refund est zappé.
        const { data: updated, error } = await admin
          .from("relations")
          .update({ status: "refused", decided_at: new Date().toISOString() })
          .eq("id", id)
          .eq("status", "pending")
          .select("id");
        if (error) {
          console.error("[decision/refuse] update failed", error);
          return NextResponse.json({ error: "update_failed" }, { status: 500 });
        }
        if (!updated || updated.length === 0) {
          return NextResponse.json({ error: "invalid_status" }, { status: 409 });
        }
      } else {
        return NextResponse.json({ error: "invalid_status" }, { status: 409 });
      }
    } else {
      // undo → ramène à pending
      if (rel.status === "accepted" || rel.status === "settled") {
        const { error } = await admin.rpc("refund_relation_tx", {
          p_relation_id: id,
          p_new_status: "pending",
        });
        if (error) return mapRpcError(error);
      } else if (rel.status === "refused") {
        // Garde TOCTOU : voir branche `refuse from pending` ci-dessus.
        const { data: updated, error } = await admin
          .from("relations")
          .update({ status: "pending", decided_at: null })
          .eq("id", id)
          .eq("status", "refused")
          .select("id");
        if (error) {
          console.error("[decision/undo] update failed", error);
          return NextResponse.json({ error: "update_failed" }, { status: 500 });
        }
        if (!updated || updated.length === 0) {
          return NextResponse.json({ error: "invalid_status" }, { status: 409 });
        }
      } else {
        return NextResponse.json({ error: "invalid_status" }, { status: 409 });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[decision] unexpected error", msg);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  // Mail de confirmation pour les transitions de décision visibles côté
  // prospect — accept et refuse (depuis pending OU rétroactif). Le `undo`
  // reste silencieux (le prospect le déclenche lui-même, c'est un retour
  // à un état antérieur, pas une nouvelle décision).
  if (action === "accept" || action === "refuse") {
    void sendDecisionEmail(admin, id, action).catch((e) => {
      console.error("[decision] email dispatch failed", e);
    });
  }

  return NextResponse.json({ ok: true });
}

type DecisionRelationRow = {
  id: string;
  reward_cents: number | string;
  founder_bonus_applied: boolean;
  founder_vip_bonus_applied: boolean;
  campaigns: { ends_at: string | null; code: string | null } | null;
  pro_accounts: {
    raison_sociale: string | null;
    secteur: string | null;
  } | null;
  prospects: {
    prospect_identity: {
      email: string | null;
      prenom: string | null;
    } | null;
  } | null;
};

async function sendDecisionEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  relationId: string,
  action: "accept" | "refuse",
): Promise<void> {
  const { data, error } = await admin
    .from("relations")
    .select(
      `id, reward_cents, motif, founder_bonus_applied, founder_vip_bonus_applied,
       campaigns ( ends_at, code ),
       pro_accounts ( raison_sociale, secteur ),
       prospects ( prospect_identity ( email, prenom ) )`,
    )
    .eq("id", relationId)
    .single();
  if (error || !data) {
    console.warn("[decision] failed to load relation for email", error);
    return;
  }
  const r = data as unknown as DecisionRelationRow & { motif: string | null };
  const email = r.prospects?.prospect_identity?.email ?? null;
  if (!email) return;
  const prenom = r.prospects?.prospect_identity?.prenom ?? null;
  const proName = (r.pro_accounts?.raison_sociale ?? "").trim() || "le professionnel";
  const proSector = r.pro_accounts?.secteur ?? null;
  const rewardEur = Number(r.reward_cents) / 100;
  const campaignEndsAt = r.campaigns?.ends_at ?? null;
  const fullCode = r.campaigns?.code ?? null;
  const authCode = fullCode ? fullCode.slice(-4) : null;

  if (action === "accept") {
    void sendRelationAccepted({
      email, prenom, proName, proSector,
      motif: r.motif ?? null,
      rewardEur, campaignEndsAt, authCode,
      founderBonusApplied: r.founder_bonus_applied === true,
      founderVipBonusApplied: r.founder_vip_bonus_applied === true,
    });
  } else {
    void sendRelationRefused({
      email, prenom, proName,
      relationId,
      rewardEur, campaignEndsAt,
    });
  }
}

function mapRpcError(error: { message?: string }) {
  const msg = error.message || "";
  for (const code of Object.keys(ACTION_TO_ERROR_HTTP)) {
    if (msg.includes(code)) {
      return NextResponse.json({ error: code }, { status: ACTION_TO_ERROR_HTTP[code] });
    }
  }
  console.error("[decision] unmapped RPC error:", msg);
  return NextResponse.json({ error: "rpc_failed", message: msg }, { status: 500 });
}
