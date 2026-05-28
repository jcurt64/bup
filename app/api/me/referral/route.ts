/**
 * GET /api/me/referral — état de parrainage de l'utilisateur courant,
 * role-agnostique (utilisable depuis l'espace pro comme prospect).
 * Renvoie toujours 200 (badgeTier:null si pas d'e-mail / pas inscrit) pour
 * ne pas casser l'en-tête qui l'affiche.
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getReferralStatus, REFERRER_CAP } from "@/lib/waitlist/referral";

export const runtime = "nodejs";

const EMPTY = {
  refCode: "",
  count: 0,
  cap: REFERRER_CAP,
  remaining: REFERRER_CAP,
  badgeTier: null,
  founderNumber: null,
  isFounder: false,
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress;

  if (!email) {
    return NextResponse.json(EMPTY);
  }

  const supabase = createSupabaseAdminClient();
  const status = await getReferralStatus(supabase, email);
  return NextResponse.json(status);
}
