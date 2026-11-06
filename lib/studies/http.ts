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
