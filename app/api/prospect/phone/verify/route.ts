/**
 * POST /api/prospect/phone/verify
 *
 * Confirme le code SMS reçu par le prospect.
 *   1. Lit la row OTP en cours pour le prospect.
 *   2. Vérifie l'expiration (10 min) + max 5 tentatives + le hash
 *      SHA-256 du code.
 *   3. Sur succès :
 *        - upsert prospect_identity.telephone + phone_verified_at = now()
 *        - supprime la row OTP.
 *
 * Body : { code: string }
 */

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;

function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.replace(/\D/g, "");
  if (v.length !== 6) return null;
  return v;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const code = normalizeCode(body.code);
  if (!code) {
    return NextResponse.json(
      { error: "invalid_code", message: "Le code doit comporter 6 chiffres." },
      { status: 400 },
    );
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const prospectId = await ensureProspect({
    clerkUserId: userId,
    email,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });

  const admin = createSupabaseAdminClient();
  const { data: otp, error: otpErr } = await admin
    .from("prospect_phone_otp")
    .select("phone, code_hash, expires_at, attempts")
    .eq("prospect_id", prospectId)
    .maybeSingle();

  if (otpErr) {
    console.error("[/api/prospect/phone/verify] read otp:", otpErr);
    return NextResponse.json({ error: "otp_read_failed" }, { status: 500 });
  }
  if (!otp) {
    return NextResponse.json(
      { error: "no_pending_otp", message: "Aucune vérification en cours. Renvoyez un code." },
      { status: 400 },
    );
  }
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    await admin.from("prospect_phone_otp").delete().eq("prospect_id", prospectId);
    return NextResponse.json(
      { error: "otp_expired", message: "Code expiré. Renvoyez un nouveau code." },
      { status: 400 },
    );
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await admin.from("prospect_phone_otp").delete().eq("prospect_id", prospectId);
    return NextResponse.json(
      { error: "too_many_attempts", message: "Trop d'essais. Renvoyez un nouveau code." },
      { status: 429 },
    );
  }

  const ok = sha256Hex(code) === otp.code_hash;
  if (!ok) {
    await admin
      .from("prospect_phone_otp")
      .update({ attempts: otp.attempts + 1, updated_at: new Date().toISOString() })
      .eq("prospect_id", prospectId);
    return NextResponse.json(
      {
        error: "invalid_code",
        message: "Code incorrect.",
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - (otp.attempts + 1)),
      },
      { status: 400 },
    );
  }

  // Succès : persiste le numéro vérifié + horodatage. On force la row
  // d'identité à exister (upsert), au cas où le prospect n'aurait pas
  // encore rempli ses informations d'identité.
  const nowIso = new Date().toISOString();
  const { error: upErr } = await admin
    .from("prospect_identity")
    .upsert(
      {
        prospect_id: prospectId,
        telephone: otp.phone,
        phone_verified_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "prospect_id" },
    );

  if (upErr) {
    console.error("[/api/prospect/phone/verify] upsert identity:", upErr);
    return NextResponse.json(
      { error: "persist_failed", message: "Vérifié mais échec d'écriture en base." },
      { status: 500 },
    );
  }

  await admin.from("prospect_phone_otp").delete().eq("prospect_id", prospectId);

  return NextResponse.json({ ok: true, phone: otp.phone, verifiedAt: nowIso });
}
