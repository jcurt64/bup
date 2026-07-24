/**
 * GET /api/admin/broadcasts/audience?audience=waitlist
 *
 * Aperçu de l'audience AVANT envoi : combien de destinataires réels, et
 * quelles lignes sont écartées (comptes de test, doublons, adresses
 * invalides). Permet à l'admin de vérifier d'un coup d'œil qu'un envoi de
 * masse ne partira pas vers des fixtures — l'envoi étant irréversible.
 *
 * Limité à l'audience « liste d'attente » (la seule qui mélange lignes
 * réelles et lignes de fixtures dans une même table publique).
 *
 * Auth : admin uniquement.
 */

import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { collectWaitlistAudience } from "@/lib/waitlist/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const audience = new URL(req.url).searchParams.get("audience");
  if (audience !== "waitlist") {
    return NextResponse.json({ error: "unsupported_audience" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { recipients, excluded, totalRows } = await collectWaitlistAudience(admin);

  return NextResponse.json({
    audience,
    totalRows,
    recipientCount: recipients.length,
    excludedCount: excluded.length,
    // Aperçu nominatif : l'admin doit pouvoir reconnaître une exclusion à
    // tort. Plafonné à 50 lignes pour ne pas alourdir la réponse.
    excluded: excluded.slice(0, 50).map((e) => ({
      email: e.row.email,
      prenom: e.row.prenom,
      reason: e.reason,
      label: e.label,
    })),
    recipients: recipients.slice(0, 50).map((r) => ({
      email: r.email,
      prenom: r.prenom,
      ville: r.ville,
    })),
  });
}
