/**
 * GET /api/prospect/fiscal/:year/dgfip-receipt — attestation de
 * transmission DGFiP au titre de l'article 242 bis du CGI.
 *
 * Toujours générable, même si le seuil n'est pas dépassé : dans ce cas
 * l'attestation indique explicitement "Non transmis (seuil non atteint)".
 * Date de transmission théorique : 31 janvier de l'année N+1.
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import {
  buildDgfipReceiptPdf,
  fiscalReference,
} from "@/lib/fiscal/pdf";
import {
  loadFiscalYear,
  loadProspectFiscalIdentity,
} from "@/lib/fiscal/data";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ year: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { year: yearStr } = await ctx.params;
  const year = Number(yearStr);
  if (!Number.isInteger(year) || year < 2020 || year > 2099) {
    return NextResponse.json({ error: "invalid_year" }, { status: 400 });
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

  const admin = createSupabaseAdminClient();
  const [totals, prospect] = await Promise.all([
    loadFiscalYear(admin, prospectId, year),
    loadProspectFiscalIdentity(admin, prospectId),
  ]);

  const reference = fiscalReference(prospectId, year, "dgfip");
  const transmittedAt = totals.reportedToDgfip
    ? new Date(Date.UTC(year + 1, 0, 31, 0, 0, 0)).toISOString()
    : null;

  const buf = await buildDgfipReceiptPdf(
    {
      year,
      totalCents: totals.totalCents,
      transactionCount: totals.transactionCount,
      reference,
      emittedAt: new Date().toISOString(),
    },
    prospect,
    {
      reportedToDgfip: totals.reportedToDgfip,
      transmittedAt,
    },
  );

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${reference}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
