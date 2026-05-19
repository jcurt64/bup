/**
 * POST /api/me/suggestions
 *
 * Reçoit le message envoyé depuis l'onglet « Vos suggestions » du dashboard,
 * le persiste en table `public.suggestions`, et le relaie en notification
 * best-effort à l'inbox BUUPP (`BUUPP_SUGGESTIONS_INBOX`, sinon la liste
 * `ADMIN_EMAILS`). On capture le nom + email depuis Clerk, et le rôle DB
 * depuis Supabase, pour pré-remplir l'expéditeur affiché.
 *
 * Anti-spam minimal : taille du body bornée + rate-limit léger côté Clerk
 * (chaque requête authentifiée passe par le middleware). Persistée en
 * table `public.suggestions` (source de vérité, lue par l'admin) ;
 * l'e-mail est une notification best-effort non bloquante.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendUserSuggestion } from "@/lib/email/user-suggestion";
import { recordEvent } from "@/lib/admin/events/record";

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

  // `suggestions` n'est pas dans les types Supabase générés (migration
  // manuelle). Cast volontaire, même esprit que lib/admin/queries/suggestions.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createSupabaseAdminClient() as any;
  const [{ data: proRow }, { data: prospectRow }] = await Promise.all([
    admin.from("pro_accounts").select("raison_sociale").eq("clerk_user_id", userId).maybeSingle(),
    admin.from("prospects").select("id").eq("clerk_user_id", userId).maybeSingle(),
  ]);
  const fromRole: "pro" | "prospect" | null = proRow ? "pro" : prospectRow ? "prospect" : null;
  // Pour un pro : on préfère la raison sociale au prénom/nom Clerk.
  if (fromRole === "pro" && proRow?.raison_sociale) {
    fromName = proRow.raison_sociale;
  }

  // E-mail = notification best-effort. La base est la source de vérité :
  // on n'échoue PAS la requête si l'e-mail tombe.
  const { ok: emailOk, messageId } = await sendUserSuggestion({
    fromEmail,
    fromName,
    fromRole,
    subject,
    message,
  });

  const nowIso = new Date().toISOString();
  const { data: inserted, error: insertError } = await admin
    .from("suggestions")
    .insert({
      from_email: fromEmail,
      from_name: fromName,
      from_role: fromRole,
      subject,
      message,
      email_sent_at: emailOk ? nowIso : null,
      email_message_id: emailOk ? (messageId ?? null) : null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    void recordEvent({
      type: "suggestions.persist_failed",
      severity: "critical",
      payload: { fromEmail, error: insertError?.message ?? "unknown" },
    });
    return NextResponse.json(
      {
        error: "persist_failed",
        message:
          "Enregistrement impossible pour le moment. Réessayez dans un instant.",
      },
      { status: 502 },
    );
  }

  if (!emailOk) {
    void recordEvent({
      type: "suggestions.email_failed",
      severity: "warning",
      payload: { fromEmail, suggestionId: inserted.id },
    });
  }

  return NextResponse.json({ ok: true });
}
