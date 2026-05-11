/**
 * POST /api/me/suggestions
 *
 * Reçoit le message envoyé depuis l'onglet « Vos suggestions » du dashboard
 * et le relaie par email à l'inbox BUUPP (`BUUPP_SUGGESTIONS_INBOX` ou
 * fallback `jjlex64@gmail.com`). On capture le nom + email depuis Clerk,
 * et le rôle DB depuis Supabase, pour pré-remplir l'expéditeur affiché.
 *
 * Anti-spam minimal : taille du body bornée + rate-limit léger côté Clerk
 * (chaque requête authentifiée passe par le middleware). Pas de stockage
 * en DB pour la v1 — l'email reste la source de vérité.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendUserSuggestion } from "@/lib/email/user-suggestion";

export const runtime = "nodejs";

const MAX_SUBJECT = 120;
const MAX_MESSAGE = 4000;

type Body = {
  subject?: string | null;
  message?: string | null;
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

  const subject = (body.subject ?? "").trim().slice(0, MAX_SUBJECT) || null;
  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json(
      { error: "missing_message", message: "Le message ne peut pas être vide." },
      { status: 400 },
    );
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: "message_too_long", message: "Message trop long (4000 caractères max)." },
      { status: 400 },
    );
  }

  // Résolution émetteur. Clerk pour l'email + le nom ; Supabase pour
  // décider du rôle (prospect / pro / null). Tout est best-effort : si
  // un appel échoue on continue avec des valeurs nulles.
  const user = await currentUser();
  const fromEmail =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  let fromName: string | null =
    `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || null;

  const admin = createSupabaseAdminClient();
  const [{ data: proRow }, { data: prospectRow }] = await Promise.all([
    admin.from("pro_accounts").select("raison_sociale").eq("clerk_user_id", userId).maybeSingle(),
    admin.from("prospects").select("id").eq("clerk_user_id", userId).maybeSingle(),
  ]);
  const fromRole: "pro" | "prospect" | null = proRow ? "pro" : prospectRow ? "prospect" : null;
  // Pour un pro : on préfère la raison sociale au prénom/nom Clerk.
  if (fromRole === "pro" && proRow?.raison_sociale) {
    fromName = proRow.raison_sociale;
  }

  const { ok } = await sendUserSuggestion({
    fromEmail,
    fromName,
    fromRole,
    subject,
    message,
  });
  if (!ok) {
    return NextResponse.json(
      {
        error: "email_failed",
        message:
          "Envoi impossible pour le moment. Réessayez dans un instant, ou écrivez-nous directement à jjlex64@gmail.com.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
