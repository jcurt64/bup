/**
 * POST /api/me/push-token — upsert du token Expo de l'appareil
 * (un row par token). Multi-device toléré : N tokens par user_id.
 *
 * DELETE /api/me/push-token — nettoyage au sign-out / désinscription.
 */
import { auth } from "@/lib/clerk/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TOKEN_RE = /^ExponentPushToken\[[A-Za-z0-9_-]{10,}\]$/;

type Body = {
  token?: unknown;
  platform?: unknown;
  appVersion?: unknown;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const platform = body.platform === "ios" || body.platform === "android" ? body.platform : "";
  if (!TOKEN_RE.test(token) || !platform) {
    return NextResponse.json({ error: "invalid_token_or_platform" }, { status: 400 });
  }
  const appVersion =
    typeof body.appVersion === "string" && body.appVersion.length < 32
      ? body.appVersion
      : null;

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("push_tokens").upsert(
    {
      user_id: userId,
      expo_token: token,
      platform,
      app_version: appVersion,
      last_seen_at: now,
    },
    { onConflict: "expo_token" },
  );
  if (error) {
    console.error("[/api/me/push-token POST] upsert failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { token?: unknown };
  try {
    body = (await req.json()) as { token?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("push_tokens")
    .delete()
    .eq("expo_token", token)
    .eq("user_id", userId);
  if (error) {
    console.error("[/api/me/push-token DELETE] delete failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
