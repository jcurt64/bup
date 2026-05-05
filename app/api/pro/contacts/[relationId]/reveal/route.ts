/**
 * POST /api/pro/contacts/[relationId]/reveal
 * Body : { field: "email" | "telephone" | "name" }
 *
 * Révèle au pro authentifié la valeur en clair de l'email, du téléphone
 * ou du nom complet (prenom + nom) d'un prospect avec qui il a une
 * relation acceptée/settled. Chaque appel réussi est enregistré dans
 * pro_contact_reveals (audit best-effort).
 *
 * 200 → { value: string }
 * 400 → field invalide
 * 401 → non authentifié
 * 403 → relation introuvable / wrong pro / status non accepted|settled
 * 404 → { error: "not_shared" }  (donnée NULL en base)
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

type Field = "email" | "telephone" | "name";
type RouteContext = { params: Promise<{ relationId: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { relationId } = await ctx.params;
  if (!relationId) {
    return NextResponse.json({ error: "missing_relation_id" }, { status: 400 });
  }

  let body: { field?: Field };
  try {
    body = (await req.json()) as { field?: Field };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const field = body?.field;
  if (field !== "email" && field !== "telephone" && field !== "name") {
    return NextResponse.json({ error: "invalid_field" }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("relations")
    .select(
      `id, status, pro_account_id,
       prospects:prospect_id (
         prospect_identity ( email, telephone, prenom, nom )
       )`,
    )
    .eq("id", relationId)
    .maybeSingle();

  if (error) {
    console.error("[/api/pro/contacts/reveal] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  type Ident = { email: string | null; telephone: string | null; prenom: string | null; nom: string | null };
  type Row = {
    id: string;
    status: string;
    pro_account_id: string;
    prospects: {
      prospect_identity: Ident | Ident[] | null;
    } | null;
  };
  const row = data as unknown as Row;
  if (row.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (row.status !== "accepted" && row.status !== "settled") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const prospects = Array.isArray(row.prospects) ? row.prospects[0] : row.prospects;
  const identRaw = prospects?.prospect_identity ?? null;
  const ident = Array.isArray(identRaw) ? identRaw[0] ?? null : identRaw;
  let value: string | null;
  if (field === "email") {
    value = ident?.email ?? null;
  } else if (field === "telephone") {
    value = ident?.telephone ?? null;
  } else {
    const full = `${ident?.prenom ?? ""} ${ident?.nom ?? ""}`.trim();
    value = full.length > 0 ? full : null;
  }
  if (!value) {
    return NextResponse.json({ error: "not_shared" }, { status: 404 });
  }

  // Audit best-effort : on ne casse pas l'usage si l'insert échoue.
  const { error: auditErr } = await admin.from("pro_contact_reveals").insert({
    pro_account_id: proId,
    relation_id: relationId,
    field,
  });
  if (auditErr) {
    console.error("[/api/pro/contacts/reveal] audit insert failed", auditErr);
  }

  return NextResponse.json({ value });
}
