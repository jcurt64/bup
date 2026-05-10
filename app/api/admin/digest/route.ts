/**
 * POST /api/admin/digest?severity=warning|info
 *
 * Cron : warning toutes les heures (à :55), info à 08:00 et 18:00.
 * Lit les events de la fenêtre [now - durée, now[ correspondante,
 * envoie un mail de digest si non vide, et trace `system.digest_sent`
 * pour la page Santé.
 *
 * Auth : x-admin-secret (le cron tourne sans session Clerk).
 */
import { NextResponse } from "next/server";
import { hasAdminSecret } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendAdminDigest } from "@/lib/email/admin-digest";
import { recordEvent } from "@/lib/admin/events/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 3_600_000;
const TWELVE_HOURS = 12 * HOUR;

export async function POST(req: Request) {
  if (!hasAdminSecret(req)) return new Response("Not Found", { status: 404 });

  const url = new URL(req.url);
  const severity = url.searchParams.get("severity");
  if (severity !== "warning" && severity !== "info") {
    return NextResponse.json({ error: "bad_severity" }, { status: 400 });
  }

  const now = new Date();
  const windowMs = severity === "warning" ? HOUR : TWELVE_HOURS;
  const start = new Date(now.getTime() - windowMs);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("admin_events")
    .select("*")
    .eq("severity", severity)
    .gte("created_at", start.toISOString())
    .lt("created_at", now.toISOString())
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[/api/admin/digest] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  await sendAdminDigest({
    severity,
    windowStart: start,
    windowEnd: now,
    events: data ?? [],
  });

  void recordEvent({
    type: "system.digest_sent",
    severity: "info",
    payload: { severity, count: data?.length ?? 0 },
  });

  return NextResponse.json({ severity, count: data?.length ?? 0 });
}
