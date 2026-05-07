/**
 * /api/prospect/rib — saisie/lecture des coordonnées bancaires (RIB).
 *
 *   POST → upsert IBAN + BIC + titulaire. Auto-validation immédiate
 *          (`validated_at = now()`) tant qu'aucune procédure de vérification
 *          tierce n'est branchée. La saisie d'un RIB déclenche le passage
 *          du palier `basique → verifie` (recalcul fait par
 *          /api/prospect/verification au prochain GET).
 *
 *   DELETE → retire le RIB (utile pour les tests, et pour un changement
 *           de banque où l'utilisateur veut effacer puis re-saisir).
 *
 * Validation IBAN : on accepte 14–34 caractères alphanumériques (norme
 * SWIFT). Pas de checksum mod 97 ici — c'est suffisant pour l'usage
 * démo ; un check-mod-97 strict pourra être ajouté quand on branchera
 * le KYC bancaire réel.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const runtime = "nodejs";

async function getProspectId(userId: string): Promise<string> {
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  return ensureProspect({
    clerkUserId: userId,
    email,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });
}

function cleanIban(input: unknown): string | null {
  if (typeof input !== "string") return null;
  // Retire espaces et tirets, met en majuscules.
  const v = input.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{14,34}$/.test(v)) return null;
  return v;
}
function cleanBic(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.replace(/\s/g, "").toUpperCase();
  if (v === "") return null;
  if (!/^[A-Z0-9]{8,11}$/.test(v)) return null;
  return v;
}
function cleanHolder(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  if (v.length < 1 || v.length > 120) return null;
  return v;
}

type RibPayload = { iban?: unknown; bic?: unknown; holderName?: unknown };

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: RibPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const iban = cleanIban(body.iban);
  const bic = cleanBic(body.bic);
  const holderName = cleanHolder(body.holderName);

  if (!iban) {
    return NextResponse.json(
      { error: "invalid_iban", message: "IBAN invalide (14 à 34 caractères alphanumériques)." },
      { status: 400 },
    );
  }
  if (!holderName) {
    return NextResponse.json(
      { error: "invalid_holder", message: "Le nom du titulaire est requis." },
      { status: 400 },
    );
  }

  const prospectId = await getProspectId(userId);
  const admin = createSupabaseAdminClient();

  // Garde-fou anti-fraude : un IBAN ne peut être associé qu'à un seul
  // prospect. Vérification explicite avant l'upsert pour produire un
  // message d'erreur clair côté client. La contrainte UNIQUE en base
  // (`prospect_rib_iban_unique`) reste le filet de sécurité en cas de
  // race condition — code Postgres `23505`.
  const { data: existing, error: lookupError } = await admin
    .from("prospect_rib")
    .select("prospect_id")
    .eq("iban", iban)
    .maybeSingle();
  if (lookupError) {
    console.error("[/api/prospect/rib POST] lookup error:", lookupError);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (existing && existing.prospect_id !== prospectId) {
    return NextResponse.json(
      {
        error: "iban_already_used",
        message:
          "Ce compte bancaire est déjà enregistré par un autre utilisateur. Pour éviter la fraude, un même RIB ne peut être associé qu'à un seul profil BUUPP.",
      },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from("prospect_rib")
    .upsert(
      {
        prospect_id: prospectId,
        iban,
        bic,
        holder_name: holderName,
        validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "prospect_id" },
    );

  if (error) {
    // Filet de sécurité : si la pré-vérification a passé mais que
    // l'unique index attrape l'IBAN (race entre deux soumissions
    // simultanées par 2 comptes différents), on renvoie le même 409.
    if (
      (error as { code?: string }).code === "23505" ||
      /prospect_rib_iban_unique/i.test(error.message ?? "")
    ) {
      return NextResponse.json(
        {
          error: "iban_already_used",
          message:
            "Ce compte bancaire est déjà enregistré par un autre utilisateur. Pour éviter la fraude, un même RIB ne peut être associé qu'à un seul profil BUUPP.",
        },
        { status: 409 },
      );
    }
    console.error("[/api/prospect/rib POST] upsert error:", error);
    return NextResponse.json({ error: "upsert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const prospectId = await getProspectId(userId);
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("prospect_rib")
    .delete()
    .eq("prospect_id", prospectId);
  if (error) {
    console.error("[/api/prospect/rib DELETE] error:", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
