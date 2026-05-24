/**
 * POST /api/me/push-test — envoie un push de test à TOUS les devices
 * enregistrés du user courant (multi-device toléré). Sert au support
 * et au bouton « Tester le push » du mobile pour valider l'E2E sans
 * dépendre du lancement d'une vraie campagne.
 *
 * Body (tous optionnels) :
 *   { kind?: "classic" | "flash" }   — défaut "classic"
 *
 * Réponse :
 *   { sent: number, tokens: number, debug: { hasExpoAccessToken: bool } }
 *
 * Le sendBatch est awaité (≠ fire-and-forget de campaigns) pour que le
 * caller obtienne un retour cohérent — on logge mais on ne fait pas
 * échouer la réponse si l'envoi Expo plante.
 */
import { auth } from "@/lib/clerk/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  buildClassicPayload,
  buildFlashPayload,
  sendBatch,
  type ExpoPushMessage,
} from "@/lib/push/expo";

export const runtime = "nodejs";

type Body = { kind?: unknown };

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // Body absent ou JSON cassé — on prend les défauts.
  }
  const kind = body.kind === "flash" ? "flash" : "classic";

  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("push_tokens")
    .select("expo_token")
    .eq("user_id", userId);
  if (error) {
    console.error("[/api/me/push-test] tokens read failed", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  const tokens = (rows ?? []).map((r) => r.expo_token as string);
  if (tokens.length === 0) {
    return NextResponse.json(
      { sent: 0, tokens: 0, reason: "no_tokens_registered" },
      { status: 200 },
    );
  }

  // IDs « test » volontairement reconnaissables côté logs / dans
  // l'event data ouvert au tap depuis la notif (le mobile route sur
  // ces écrans même si les IDs ne correspondent à rien en DB — c'est
  // du test).
  const messages: ExpoPushMessage[] = tokens.map((token) =>
    kind === "flash"
      ? buildFlashPayload({
          token,
          proName: "Atelier Test",
          rewardEur: 12.5,
          relationId: "test-flash-relation",
          campaignId: "test-flash-campaign",
        })
      : buildClassicPayload({
          token,
          proName: "Atelier Test",
          rewardEur: 8,
          durationKey: "24h",
          relationId: "test-classic-relation",
        }),
  );

  try {
    await sendBatch(admin, messages);
  } catch (e) {
    console.error("[/api/me/push-test] sendBatch threw", e);
  }

  return NextResponse.json({
    sent: messages.length,
    tokens: tokens.length,
    kind,
    debug: { hasExpoAccessToken: !!process.env.EXPO_ACCESS_TOKEN },
  });
}
