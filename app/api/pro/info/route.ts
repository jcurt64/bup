/**
 * /api/pro/info — informations société du pro courant.
 *
 *   GET   → { raisonSociale, adresse, ville, codePostal, siren, secteur }
 *   PATCH → applique un update partiel sur pro_accounts (mêmes champs).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import type { Database } from "@/lib/supabase/types";

type ProAccountUpdate = Database["public"]["Tables"]["pro_accounts"]["Update"];

export const runtime = "nodejs";

type InfoBody = {
  raisonSociale?: string | null;
  adresse?: string | null;
  ville?: string | null;
  codePostal?: string | null;
  siren?: string | null;
  secteur?: string | null;
};

const SIREN_REGEX = /^[0-9]{9}$/;

async function getProId(): Promise<{ proId?: string; resp?: NextResponse }> {
  const { userId } = await auth();
  if (!userId) {
    return { resp: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });
  return { proId };
}

export async function GET() {
  const { proId, resp } = await getProId();
  if (resp) return resp;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("pro_accounts")
    .select("raison_sociale, adresse, ville, code_postal, siren, secteur")
    .eq("id", proId!)
    .single();
  if (error || !data) {
    console.error("[/api/pro/info GET] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  return NextResponse.json({
    raisonSociale: data.raison_sociale ?? "",
    adresse: data.adresse ?? "",
    ville: data.ville ?? "",
    codePostal: data.code_postal ?? "",
    siren: data.siren ?? "",
    secteur: data.secteur ?? "",
  });
}

export async function PATCH(req: Request) {
  const { proId, resp } = await getProId();
  if (resp) return resp;

  let body: InfoBody;
  try { body = (await req.json()) as InfoBody; }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  // Build the partial update — only include keys actually present in the body.
  const update: ProAccountUpdate = {};

  function coerce(v: string | null | undefined): string | null {
    if (v == null || v === "") return null;
    return v.trim().slice(0, 200);
  }

  if ("raisonSociale" in body) update.raison_sociale = coerce(body.raisonSociale) ?? undefined;
  if ("adresse"       in body) update.adresse        = coerce(body.adresse);
  if ("ville"         in body) update.ville          = coerce(body.ville);
  if ("codePostal"    in body) update.code_postal    = coerce(body.codePostal);
  if ("siren"         in body) update.siren          = coerce(body.siren);
  if ("secteur"       in body) update.secteur        = coerce(body.secteur);

  if (update.siren != null && update.siren !== "" && !SIREN_REGEX.test(update.siren)) {
    return NextResponse.json({ error: "invalid_siren" }, { status: 400 });
  }
  // raison_sociale is NOT NULL in DB — don't allow erasing it.
  if ("raison_sociale" in update && (update.raison_sociale == null || update.raison_sociale === "")) {
    return NextResponse.json({ error: "raison_sociale_required" }, { status: 400 });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pro_accounts")
    .update(update)
    .eq("id", proId!);
  if (error) {
    console.error("[/api/pro/info PATCH] update failed", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated: Object.keys(update).length });
}
