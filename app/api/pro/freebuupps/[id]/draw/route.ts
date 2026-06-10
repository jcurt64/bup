/**
 * POST /api/pro/freebuupps/[id]/draw — lance le tirage (vérifiable) d'un
 * FREEBUUPP clôturé. Idempotent : 409 si déjà tiré/annulé, 409 si pas encore
 * clôturé. Déclenche les notifications gagnants/perdants en fire-and-forget.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { executeDraw } from "@/lib/freebuupp/lifecycle";
import { notifyFreebuuppResults } from "@/lib/freebuupp/mail";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  const admin = createSupabaseAdminClient();

  const { data: fb } = await admin
    .from("freebuupps")
    .select("id, status, closes_at")
    .eq("id", id)
    .eq("pro_account_id", proId)
    .single();
  if (!fb) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (fb.status === "drawn" || fb.status === "canceled") {
    return NextResponse.json({ error: "already_drawn" }, { status: 409 });
  }
  if (fb.status === "open" && new Date(fb.closes_at).getTime() > Date.now()) {
    return NextResponse.json({ error: "not_closed_yet" }, { status: 409 });
  }

  // L'horloge a passé closes_at mais le cron n'a pas encore matérialisé
  // la fermeture : on la force avant de tirer.
  if (fb.status === "open") {
    await admin.from("freebuupps").update({ status: "closed" }).eq("id", id);
  }

  const res = await executeDraw(admin, id);
  if (res.status === "drawn") {
    void notifyFreebuuppResults(admin, id).catch((e) =>
      console.error("[freebuupp draw] notify failed", e),
    );
  }
  return NextResponse.json({ result: res });
}
