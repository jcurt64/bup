/**
 * POST /api/admin/digest?severity=warning|info|daily
 *
 * Cron : `daily` une fois par jour à 18:00 (Vercel Hobby ne permet
 * qu'un cron quotidien). `warning` et `info` restent supportés pour les
 * déclenchements manuels (curl + x-admin-secret) si on veut un digest
 * ad-hoc à granularité plus fine.
 *
 * Modes :
 *   - warning → fenêtre = 1h, severity = warning
 *   - info    → fenêtre = 12h, severity = info
 *   - daily   → fenêtre = 24h, agrège warning + info dans un seul mail
 *
 * Trace `system.digest_sent` dans admin_events pour la page Santé.
 *
 * Auth : x-admin-secret (le cron tourne sans session Clerk).
 */
import { NextResponse } from "next/server";
import { hasAdminSecret } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendAdminDigest } from "@/lib/email/admin-digest";
import { recordEvent } from "@/lib/admin/events/record";
import { applyCnilBasculeIfDue } from "@/lib/cnil/bascule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 3_600_000;
const TWELVE_HOURS = 12 * HOUR;
const TWENTY_FOUR_HOURS = 24 * HOUR;

type Mode = "warning" | "info" | "daily";

export async function POST(req: Request) {
  if (!hasAdminSecret(req)) return new Response("Not Found", { status: 404 });

  const url = new URL(req.url);
  const raw = url.searchParams.get("severity");
  if (raw !== "warning" && raw !== "info" && raw !== "daily") {
    return NextResponse.json({ error: "bad_severity" }, { status: 400 });
  }
  const mode = raw as Mode;

  const now = new Date();
  const windowMs =
    mode === "warning" ? HOUR : mode === "info" ? TWELVE_HOURS : TWENTY_FOUR_HOURS;
  const start = new Date(now.getTime() - windowMs);

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("admin_events")
    .select("*")
    .gte("created_at", start.toISOString())
    .lt("created_at", now.toISOString())
    .order("created_at", { ascending: false });

  if (mode === "daily") {
    // Agrège warning + info dans la fenêtre 24h.
    query = query.in("severity", ["warning", "info"] as never);
  } else {
    query = query.eq("severity", mode as never);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[/api/admin/digest] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  // Le mail digest n'attend qu'une seule severity dans son sujet — pour
  // le mode `daily`, on étiquette « info » (les warnings sont déjà
  // visibles dans la liste détaillée du mail).
  const mailSeverity: "warning" | "info" = mode === "warning" ? "warning" : "info";

  await sendAdminDigest({
    severity: mailSeverity,
    windowStart: start,
    windowEnd: now,
    events: data ?? [],
  });

  void recordEvent({
    type: "system.digest_sent",
    severity: "info",
    payload: { mode, count: data?.length ?? 0 },
  });

  // Piggyback CNIL : la bascule du 15 juillet 2026 (reset des consentements
  // implicites) ne peut pas avoir son propre cron sur le plan Hobby (limite
  // 1/jour, déjà utilisé). On l'attache donc à ce cron quotidien qui tourne
  // tous les jours à 18:00 UTC. La fonction est gardée par date + idempotence
  // (event admin), donc elle ne fait rien tant qu'on n'est pas le 15/07/2026,
  // et elle ne s'applique qu'une seule fois ensuite. Cf. lib/cnil/bascule.ts.
  let bascule: Awaited<ReturnType<typeof applyCnilBasculeIfDue>> | null = null;
  if (mode === "daily") {
    try {
      bascule = await applyCnilBasculeIfDue(admin);
    } catch (err) {
      console.error("[/api/admin/digest] CNIL bascule failed", err);
    }
  }

  return NextResponse.json({
    mode,
    count: data?.length ?? 0,
    cnilBascule: bascule ?? null,
  });
}
