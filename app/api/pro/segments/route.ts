/**
 * /api/pro/segments — segments enregistrés du pro (atelier de segmentation).
 *   GET ?campaignId= → liste les segments du pro pour la campagne.
 *   POST { campaignId, name, filters } → crée un segment (filters sanités).
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { sanitizeFilters } from "@/lib/pro/segmentation/filter";

export const runtime = "nodejs";

async function getProId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  return ensureProAccount({ clerkUserId: userId, email });
}

export async function GET(req: Request) {
  const proId = await getProId();
  if (!proId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const campaignId = new URL(req.url).searchParams.get("campaignId");
  if (!campaignId) return NextResponse.json({ error: "missing_campaign_id" }, { status: 400 });

  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { data, error } = await admin
    .from("pro_segments")
    .select("id, name, filters, created_at")
    .eq("pro_account_id", proId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[/api/pro/segments GET] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  return NextResponse.json({ segments: data ?? [] });
}

export async function POST(req: Request) {
  const proId = await getProId();
  if (!proId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const o = (body ?? {}) as Record<string, unknown>;
  const campaignId = typeof o.campaignId === "string" ? o.campaignId : null;
  const name = typeof o.name === "string" ? o.name.trim().slice(0, 80) : "";
  if (!campaignId || !name) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  const filters = sanitizeFilters(o.filters);

  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
  // Ownership de la campagne : on n'enregistre un segment que sur une campagne du pro.
  const { data: camp } = await admin
    .from("campaigns").select("pro_account_id").eq("id", campaignId).maybeSingle();
  if (!camp || (camp as { pro_account_id?: string }).pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("pro_segments")
    .insert({ pro_account_id: proId, campaign_id: campaignId, name, filters })
    .select("id, name, filters, created_at")
    .maybeSingle();
  if (error) {
    console.error("[/api/pro/segments POST] insert failed", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ segment: data });
}
