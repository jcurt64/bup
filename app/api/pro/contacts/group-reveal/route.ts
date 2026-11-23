/**
 * POST /api/pro/contacts/group-reveal — SUPPRIMÉ.
 *
 * Révélait en clair les e-mails de prospects pour un « message groupé » via
 * mailto (BCC). Incompatible avec le pivot « mise en relation pure » : le pro
 * ne reçoit jamais les coordonnées brutes. Le message groupé passe désormais
 * par l'envoi médié POST /api/pro/segments/broadcast (avec `relationIds`).
 *
 * 410 → { error: "group_reveal_removed" }
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "group_reveal_removed",
      message:
        "Le message groupé passe désormais par l'envoi sécurisé BUUPP (POST /api/pro/segments/broadcast).",
    },
    { status: 410 },
  );
}
