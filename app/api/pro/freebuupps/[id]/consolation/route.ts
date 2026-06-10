/**
 * POST /api/pro/freebuupps/[id]/consolation — le pro envoie UN mail groupé
 * (unique) aux prospects NON tirés au sort, pour présenter ses services.
 *
 * Gardes : flag actif, ownership, FREEBUUPP `drawn`, pas déjà envoyé
 * (`consolation_sent_at` null), message non vide. Verrou single-send :
 * on pose `consolation_sent_at` AVANT l'envoi (idempotence best-effort).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { isFreebuuppEnabled } from "@/lib/freebuupp/config";
import { sendFreebuuppConsolationEmail } from "@/lib/email/freebuupp-consolation";

export const runtime = "nodejs";

const MAX_MESSAGE = 1500;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { message?: string };
  try {
    body = (await req.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "empty_message" }, { status: 400 });
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "message_too_long", max: MAX_MESSAGE }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  const admin = createSupabaseAdminClient();

  if (!(await isFreebuuppEnabled(admin))) {
    return NextResponse.json({ error: "freebuupp_disabled" }, { status: 403 });
  }

  const { data: fb } = await admin
    .from("freebuupps")
    .select("id, title, brand_name, status, consolation_sent_at")
    .eq("id", id)
    .eq("pro_account_id", proId)
    .single();
  if (!fb) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (fb.status !== "drawn") return NextResponse.json({ error: "not_drawn" }, { status: 409 });
  if (fb.consolation_sent_at) {
    return NextResponse.json({ error: "already_sent" }, { status: 409 });
  }

  // Verrou single-send : on pose le timestamp AVANT l'envoi pour éviter
  // un double envoi sur double-clic / retry. On le conditionne à NULL via
  // un filtre pour rester idempotent en cas de course.
  const { data: locked, error: lockErr } = await admin
    .from("freebuupps")
    .update({ consolation_sent_at: new Date().toISOString() })
    .eq("id", fb.id)
    .is("consolation_sent_at", null)
    .select("id");
  if (lockErr) {
    console.error("[freebuupp/consolation] lock failed", lockErr);
    return NextResponse.json({ error: "lock_failed" }, { status: 500 });
  }
  if (!locked || locked.length === 0) {
    return NextResponse.json({ error: "already_sent" }, { status: 409 });
  }

  // Destinataires = participants NON gagnants.
  const { data: losers } = await admin
    .from("freebuupp_participants")
    .select("prospect_id")
    .eq("freebuupp_id", fb.id)
    .eq("is_winner", false);
  const pids = (losers ?? []).map((l) => l.prospect_id);
  if (pids.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const { data: idents } = await admin
    .from("prospect_identity")
    .select("email, prenom")
    .in("prospect_id", pids);
  const recipients = (idents ?? []).filter((i) => !!i.email);

  await Promise.allSettled(
    recipients.map((r) =>
      sendFreebuuppConsolationEmail({
        email: r.email as string,
        prenom: r.prenom ?? null,
        brand: fb.brand_name,
        title: fb.title,
        message,
      }),
    ),
  );

  return NextResponse.json({ sent: recipients.length });
}
