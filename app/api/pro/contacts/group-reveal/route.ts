/**
 * POST /api/pro/contacts/group-reveal
 * Body : { relationIds: string[] }   (1..50 ids)
 *
 * Révèle en clair les emails des prospects sélectionnés (relations
 * accepted/settled appartenant au pro authentifié) et logue chaque
 * accès dans pro_contact_reveals (field='email'). Utilisé par le
 * bouton "Message groupé" de l'onglet Mes contacts.
 *
 * 200 → { items: [{ relationId, email | null }], proEmail }
 *       email = null si la relation n'appartient pas au pro / n'est
 *       pas en bon statut / l'email n'est pas partagé. Le client filtre.
 *       proEmail = email primaire Clerk du pro authentifié — utilisé
 *       par le client pour pré-remplir le champ `to:` du mailto (les
 *       prospects sont en BCC). Évite un `to:` vide qui peut être rejeté
 *       par certains serveurs SMTP et garantit la même UX sur tous les
 *       clients mail.
 * 400 → body invalide ou vide
 * 401 → non authentifié
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

const MAX_IDS = 50;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { relationIds?: unknown };
  try {
    body = (await req.json()) as { relationIds?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const ids = Array.isArray(body?.relationIds) ? body!.relationIds : null;
  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: "empty_relation_ids" }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: "too_many_ids" }, { status: 400 });
  }
  const cleanIds = ids.filter((x): x is string => typeof x === "string" && x.length > 0);
  if (cleanIds.length === 0) {
    return NextResponse.json({ error: "invalid_relation_ids" }, { status: 400 });
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
         prospect_identity ( email )
       )`,
    )
    .in("id", cleanIds);

  if (error) {
    console.error("[/api/pro/contacts/group-reveal] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type Row = {
    id: string;
    status: string;
    pro_account_id: string;
    prospects: {
      prospect_identity:
        | { email: string | null }
        | { email: string | null }[]
        | null;
    } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const items: Array<{ relationId: string; email: string | null }> = [];
  const auditPayload: Array<{ pro_account_id: string; relation_id: string; field: string }> = [];

  for (const id of cleanIds) {
    const row = rows.find((r) => r.id === id) ?? null;
    if (
      !row ||
      row.pro_account_id !== proId ||
      (row.status !== "accepted" && row.status !== "settled")
    ) {
      items.push({ relationId: id, email: null });
      continue;
    }
    const prospects = Array.isArray(row.prospects) ? row.prospects[0] : row.prospects;
    const identRaw = prospects?.prospect_identity ?? null;
    const ident = Array.isArray(identRaw) ? identRaw[0] ?? null : identRaw;
    const value = ident?.email ?? null;
    if (!value) {
      items.push({ relationId: id, email: null });
      continue;
    }
    items.push({ relationId: id, email: value });
    auditPayload.push({ pro_account_id: proId, relation_id: id, field: "email" });
  }

  if (auditPayload.length > 0) {
    const { error: auditErr } = await admin.from("pro_contact_reveals").insert(auditPayload);
    if (auditErr) {
      console.error("[/api/pro/contacts/group-reveal] audit insert failed", auditErr);
    }
  }

  return NextResponse.json({ items, proEmail: email });
}
