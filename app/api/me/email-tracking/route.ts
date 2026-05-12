/**
 * GET  /api/me/email-tracking → { consent: boolean }
 * PATCH /api/me/email-tracking { consent: boolean } → { ok, consent }
 *
 * Toggle utilisateur (depuis Préférences / Mes informations) du
 * consentement au pixel de tracking dans les broadcasts. Auth Clerk
 * obligatoire (≠ de l'opt-out 1-clic par token qui sert depuis l'email).
 * Le rôle est résolu côté serveur (mutuellement exclusif prospect/pro
 * depuis la migration 20260508140000).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function resolveRole(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
): Promise<{ role: "prospect" | "pro"; ownerId: string } | null> {
  const [{ data: proRow }, { data: prospectRow }] = await Promise.all([
    admin.from("pro_accounts").select("id").eq("clerk_user_id", userId).maybeSingle(),
    admin.from("prospects").select("id").eq("clerk_user_id", userId).maybeSingle(),
  ]);
  if (proRow) return { role: "pro", ownerId: proRow.id };
  if (prospectRow) return { role: "prospect", ownerId: prospectRow.id };
  return null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const resolved = await resolveRole(admin, userId);
  if (!resolved) {
    return NextResponse.json({ error: "no_role" }, { status: 404 });
  }

  // Lecture du flag depuis la bonne table selon le rôle.
  let consent = true;
  if (resolved.role === "prospect") {
    const { data } = await admin
      .from("prospect_identity")
      .select("email_tracking_consent")
      .eq("prospect_id", resolved.ownerId)
      .maybeSingle();
    // Si la row palier 1 n'existe pas encore (création différée), on
    // s'aligne sur le default DB (true en transition).
    consent = data?.email_tracking_consent ?? true;
  } else {
    const { data } = await admin
      .from("pro_accounts")
      .select("email_tracking_consent")
      .eq("id", resolved.ownerId)
      .maybeSingle();
    consent = data?.email_tracking_consent ?? true;
  }

  return NextResponse.json({ consent, role: resolved.role });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { consent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.consent !== "boolean") {
    return NextResponse.json({ error: "invalid_consent" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const resolved = await resolveRole(admin, userId);
  if (!resolved) {
    return NextResponse.json({ error: "no_role" }, { status: 404 });
  }

  // Horodatage d'audit : timestamp quand consentement EXPLICITE (true),
  // null quand opt-out. La bascule CNIL du 15 juillet 2026 utilise ce
  // champ pour distinguer "default acquis en transition" de "consentement
  // positif documenté" (cf. lib/cnil/bascule.ts).
  const consentGivenAt = body.consent ? new Date().toISOString() : null;

  // Helper local : Supabase renvoie un PostgrestError dont les
  // propriétés sont non-énumérables → console.error(..., err) loggue
  // `{}`. On extrait explicitement les champs utiles pour pouvoir
  // diagnostiquer (colonne manquante, contrainte violée, etc.).
  const fmtErr = (e: { message?: string; code?: string; details?: string; hint?: string } | null) =>
    e
      ? `code=${e.code ?? "?"} message=${e.message ?? "?"} details=${e.details ?? "?"} hint=${e.hint ?? "?"}`
      : "(no error)";

  if (resolved.role === "prospect") {
    // Upsert palier 1 — au cas où la row n'existerait pas encore. On
    // n'écrase rien d'autre.
    const { error } = await admin
      .from("prospect_identity")
      .upsert(
        {
          prospect_id: resolved.ownerId,
          email_tracking_consent: body.consent,
          email_tracking_consent_given_at: consentGivenAt,
        },
        { onConflict: "prospect_id" },
      );
    if (error) {
      console.error("[/api/me/email-tracking PATCH] prospect update failed →", fmtErr(error));
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
  } else {
    const { error } = await admin
      .from("pro_accounts")
      .update({
        email_tracking_consent: body.consent,
        email_tracking_consent_given_at: consentGivenAt,
      })
      .eq("id", resolved.ownerId);
    if (error) {
      console.error("[/api/me/email-tracking PATCH] pro update failed →", fmtErr(error));
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, consent: body.consent });
}
