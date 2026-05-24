/**
 * GET /api/me/push-status — diagnostic de l'enregistrement push de
 * l'utilisateur courant. Renvoie la liste de ses tokens enregistrés
 * (masqués pour ne pas leak le token complet aux logs) + un check
 * d'environnement basique. Sert l'écran « Test push » du mobile et le
 * debug côté support.
 *
 * Aucun secret n'est renvoyé : seules les 8 dernières chars du token
 * Expo sont exposées (suffisant pour différencier 2 devices, pas assez
 * pour ré-emettre des pushs).
 */
import { auth } from "@/lib/clerk/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function maskToken(t: string): string {
  // "ExponentPushToken[xxxxxxxxxxxxxx]" → "…xxxxxxxx]"
  const tail = t.slice(-9);
  return `…${tail}`;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("push_tokens")
    .select("expo_token, platform, app_version, last_seen_at, created_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false });
  if (error) {
    console.error("[/api/me/push-status] read failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  const tokens = (data ?? []).map((row) => ({
    masked: maskToken(row.expo_token as string),
    platform: row.platform,
    appVersion: row.app_version,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  }));
  return NextResponse.json({
    tokens,
    env: {
      hasExpoAccessToken: !!process.env.EXPO_ACCESS_TOKEN,
    },
  });
}
