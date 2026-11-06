import { NextResponse } from "next/server";
import { getStudiesEnabled } from "./flag";

/** 404 tant que le module est désactivé (spec §13). */
export async function studiesDisabledResponse(): Promise<NextResponse | null> {
  return (await getStudiesEnabled()) ? null : NextResponse.json({ error: "not_found" }, { status: 404 });
}

export const err = (error: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

/** Traduit une exception RPC (`raise exception 'code'`) en code d'erreur. */
export function rpcErrorCode(e: { message?: string } | null | undefined): string {
  const m = e?.message ?? "";
  return m.split(":")[0].trim() || "rpc_failed";
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { prospectContext, proAccountIdFor, type ProspectCtx } from "./repo";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/** Prospect connecté + module actif, sinon réponse d'erreur. */
export async function requireProspect(): Promise<
  { ok: true; admin: AdminClient; ctx: ProspectCtx } | { ok: false; res: NextResponse }
> {
  const off = await studiesDisabledResponse();
  if (off) return { ok: false, res: off };
  const { userId } = await auth();
  if (!userId) return { ok: false, res: err("unauthorized", 401) };
  const admin = createSupabaseAdminClient();
  const ctx = await prospectContext(admin, userId);
  if (!ctx) return { ok: false, res: err("not_prospect", 403) };
  return { ok: true, admin, ctx };
}

/** Pro connecté + module actif, sinon réponse d'erreur. */
export async function requirePro(): Promise<
  { ok: true; admin: AdminClient; proId: string } | { ok: false; res: NextResponse }
> {
  const off = await studiesDisabledResponse();
  if (off) return { ok: false, res: off };
  const { userId } = await auth();
  if (!userId) return { ok: false, res: err("unauthorized", 401) };
  const admin = createSupabaseAdminClient();
  const proId = await proAccountIdFor(admin, userId);
  if (!proId) return { ok: false, res: err("not_pro", 403) };
  return { ok: true, admin, proId };
}
