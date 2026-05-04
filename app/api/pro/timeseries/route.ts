/**
 * GET /api/pro/timeseries?range=7d|30d|90d — bucketized acceptance counts.
 *
 * Renvoie une série temporelle des relations gagnées (status accepted ou
 * settled) du pro courant, découpée en buckets selon la fenêtre demandée.
 *
 *  - 7d  → 7 buckets quotidiens, label = jour FR (Lun, Mar, …, Dim)
 *  - 30d → 10 buckets de 3 jours, label = "J-27", "J-24", …, "J-0"
 *  - 90d → 13 buckets hebdo (91 jours), label = "S1"…"S13"
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

type Range = "7d" | "30d" | "90d";

const DAY_MS = 86_400_000;

const DAY_LABELS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function rangeStart(range: Range): Date {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 91;
  return new Date(Date.now() - days * DAY_MS);
}

type Bucket = { start: string; end: string; label: string; count: number };

function buildBuckets(range: Range, now: Date): Bucket[] {
  const buckets: Bucket[] = [];
  if (range === "7d") {
    // 7 daily buckets, oldest first.
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * DAY_MS + 1);
      const end = new Date(now.getTime() - i * DAY_MS);
      buckets.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: DAY_LABELS_FR[end.getDay()],
        count: 0,
      });
    }
  } else if (range === "30d") {
    // 10 buckets of 3 days, oldest first. Labels J-27, J-24, …, J-0.
    for (let i = 9; i >= 0; i--) {
      const start = new Date(now.getTime() - (i * 3 + 3) * DAY_MS + 1);
      const end = new Date(now.getTime() - i * 3 * DAY_MS);
      buckets.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: `J-${i * 3}`,
        count: 0,
      });
    }
  } else {
    // 13 weekly buckets, label S1..S13 (S13 = current week).
    for (let i = 12; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * 7 * DAY_MS + 1);
      const end = new Date(now.getTime() - i * 7 * DAY_MS);
      buckets.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: `S${13 - i}`,
        count: 0,
      });
    }
  }
  return buckets;
}

function bucketIndex(decidedAt: string, buckets: Bucket[]): number {
  const t = new Date(decidedAt).getTime();
  for (let i = 0; i < buckets.length; i++) {
    const s = new Date(buckets[i].start).getTime();
    const e = new Date(buckets[i].end).getTime();
    if (t >= s && t <= e) return i;
  }
  return -1;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range");
  const range: Range = rangeParam === "7d" || rangeParam === "90d" ? rangeParam : "30d";

  const user = await currentUser();
  const email = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const sinceIso = rangeStart(range).toISOString();

  const { data, error } = await admin
    .from("relations")
    .select("status, decided_at")
    .eq("pro_account_id", proId)
    .in("status", ["accepted", "settled"])
    .gte("decided_at", sinceIso);

  if (error) {
    console.error("[/api/pro/timeseries] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const now = new Date();
  const buckets = buildBuckets(range, now);
  for (const r of (data ?? [])) {
    if (!r.decided_at) continue;
    const idx = bucketIndex(r.decided_at, buckets);
    if (idx >= 0) buckets[idx].count++;
  }

  return NextResponse.json({ range, buckets });
}
