/**
 * POST /api/prospect/tier — ancienne gestion de la visibilité des paliers
 *                           (hide / restore / delete) de « Mes données ».
 *
 * Pivot « mise en relation pure » : les paliers de données n'existent plus
 * (seul le profil contact prénom / initiale / e-mail / téléphone subsiste).
 * L'endpoint reste en vie pour les applications mobiles déjà publiées et
 * répond un payload neutre (no-op 200). La suppression des données se fait
 * désormais par la suppression du compte.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Corps lu pour rester tolérant (JSON invalide = no-op aussi).
  await req.json().catch(() => null);
  return NextResponse.json({
    ok: true,
    ignored: true,
    hiddenTiers: [],
    removedTiers: [],
  });
}
