/**
 * GET /api/inbound/relation/resolve?alias=<alias_short>
 *
 * Endpoint appelé par le Cloudflare Email Worker
 * (cf. cloudflare-workers/relation-email-router) pour résoudre un alias
 * `prospect+r{alias_short}@buupp.com` vers le vrai email du prospect.
 *
 * Authentification : header `x-inbound-secret` qui doit matcher
 * `INBOUND_RELAY_SECRET` (env). Pas de session Clerk : le Worker n'a pas
 * de cookies. Le secret doit avoir au moins 32 chars (entropie suffisante
 * pour résister au brute force ; en cas de fuite, rotation par variable
 * d'environnement).
 *
 * 200 → { email: string, relationId: string }
 * 401 → secret manquant ou invalide
 * 404 → alias inconnu (ou prospect sans email — improbable)
 * 500 → erreur serveur (DB indisponible, etc.)
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveAlias } from "@/lib/aliases/relation-email";

export const runtime = "nodejs";

const MIN_SECRET_LEN = 32;

export async function GET(req: Request) {
  const secret = process.env.INBOUND_RELAY_SECRET;
  if (!secret || secret.length < MIN_SECRET_LEN) {
    console.error("[/api/inbound/relation/resolve] INBOUND_RELAY_SECRET missing or too short");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const provided = req.headers.get("x-inbound-secret");
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const alias = url.searchParams.get("alias")?.trim() ?? "";
  if (!/^[a-z0-9]{8,16}$/.test(alias)) {
    return NextResponse.json({ error: "invalid_alias" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const resolved = await resolveAlias(admin, alias);
  if (!resolved) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    email: resolved.prospectEmail,
    relationId: resolved.relationId,
  });
}
