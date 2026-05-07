/**
 * POST /api/prospect/phone/start
 *
 * Démarre la vérification SMS du téléphone du prospect.
 *   1. Normalise le numéro vers E.164 (force `+33` pour les `06…`).
 *   2. Génère un code à 6 chiffres + le hashe (SHA-256 hex).
 *   3. Upsert dans `prospect_phone_otp` (TTL 10 min, attempts=0).
 *   4. Envoie le SMS via Brevo. Si BREVO_API_KEY manque, on bascule
 *      en "dev mode" : le code est renvoyé dans la réponse pour que
 *      la modale puisse le pré-remplir.
 *
 * Body : { phone: string }
 */

import { NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import { sendSms, isBrevoConfigured } from "@/lib/brevo/sms";

export const runtime = "nodejs";

const OTP_TTL_MINUTES = 10;

function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  const cleaned = trimmed.startsWith("+")
    ? "+" + trimmed.slice(1).replace(/[^\d]/g, "")
    : trimmed.replace(/[^\d]/g, "");
  const digits = cleaned.replace(/^\+/, "");
  if (digits.length < 8 || digits.length > 16) return null;
  if (!cleaned.startsWith("+")) {
    // Format FR sans préfixe → on force +33.
    if (cleaned.startsWith("0") && cleaned.length === 10) {
      return "+33" + cleaned.slice(1);
    }
    return "+" + cleaned;
  }
  return cleaned;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "invalid_phone", message: "Numéro invalide. Format attendu : +33612345678 ou 0612345678." },
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

  // Garde-fou anti-fraude : un numéro de téléphone ne peut être associé
  // qu'à un seul prospect. On vérifie ICI (avant d'envoyer le SMS) plutôt
  // que d'attendre l'étape verify — le pro éconnomise un crédit Brevo et
  // l'utilisateur reçoit le message d'erreur instantanément.
  const adminEarly = createSupabaseAdminClient();
  const { data: existingPhone, error: phoneLookupErr } = await adminEarly
    .from("prospect_identity")
    .select("prospect_id")
    .eq("telephone", phone)
    .maybeSingle();
  if (phoneLookupErr) {
    console.error("[/api/prospect/phone/start] phone lookup error:", phoneLookupErr);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (existingPhone && existingPhone.prospect_id !== prospectId) {
    return NextResponse.json(
      {
        error: "phone_already_used",
        message:
          "Ce numéro est déjà rattaché à un compte. Pour éviter la fraude, un numéro ne peut être associé qu'à un seul profil BUUPP.",
      },
      { status: 409 },
    );
  }

  // Code 6 chiffres, padding à gauche pour longueur fixe.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = sha256Hex(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

  const admin = adminEarly;
  const { error: upErr } = await admin
    .from("prospect_phone_otp")
    .upsert(
      {
        prospect_id: prospectId,
        phone,
        code_hash: codeHash,
        expires_at: expiresAt,
        attempts: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "prospect_id" },
    );

  if (upErr) {
    console.error("[/api/prospect/phone/start] upsert error:", upErr);
    return NextResponse.json(
      { error: "persist_failed", message: "Échec d'écriture en base." },
      { status: 500 },
    );
  }

  const message = `BUUPP : votre code de vérification est ${code}. Valable 10 minutes. Ne le partagez avec personne.`;
  try {
    const r = await sendSms(phone, message);
    return NextResponse.json({
      ok: true,
      brevo: isBrevoConfigured(),
      // En mode dev (sans Brevo configuré), on renvoie le code pour
      // que la modale puisse le pré-remplir et tester le flow front.
      devCode: r.devMode ? code : undefined,
      normalizedPhone: phone,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Échec de l'envoi du SMS.";
    console.error("[/api/prospect/phone/start] brevo error:", e);
    return NextResponse.json(
      {
        error: "sms_send_failed",
        message: msg,
        normalizedPhone: phone,
      },
      { status: 502 },
    );
  }
}
