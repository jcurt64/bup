/**
 * GET /api/landing/flash-deals — public, no auth.
 * Renvoie la première campagne "flash deal" (durationKey=1h) actuellement
 * active dont la fenêtre n'a pas expiré, avec le pro émetteur, le
 * multiplicateur appliqué aux gains, et le timestamp d'expiration pour
 * alimenter le compte à rebours côté home page.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("campaigns")
    .select(
      `id, name, ends_at, targeting,
       pro_accounts ( raison_sociale, secteur )`,
    )
    .eq("status", "active")
    .gt("ends_at", nowIso)
    .order("ends_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[/api/landing/flash-deals] read failed", error);
    return NextResponse.json({ deals: [] });
  }

  type Row = {
    id: string;
    name: string;
    ends_at: string;
    targeting: { durationKey?: string; durationMultiplier?: number } | null;
    pro_accounts: { raison_sociale: string | null; secteur: string | null } | { raison_sociale: string | null; secteur: string | null }[] | null;
  };
  const flashes = ((data ?? []) as unknown as Row[])
    .filter((r) => r.targeting?.durationKey === "1h")
    .map((r) => {
      const pro = Array.isArray(r.pro_accounts) ? r.pro_accounts[0] : r.pro_accounts;
      return {
        id: r.id,
        name: r.name,
        endsAt: r.ends_at,
        multiplier: Number(r.targeting?.durationMultiplier ?? 3),
        proName: pro?.raison_sociale ?? null,
        proSector: pro?.secteur ?? null,
      };
    });

  return NextResponse.json({ deals: flashes });
}
