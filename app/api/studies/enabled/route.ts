/** GET /api/studies/enabled — état de l'interrupteur du module (onglets du tableau de bord). */
import { NextResponse } from "next/server";
import { getStudiesEnabled } from "@/lib/studies/flag";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ enabled: await getStudiesEnabled() });
}
