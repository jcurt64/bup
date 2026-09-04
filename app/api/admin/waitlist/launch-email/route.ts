/**
 * POST /api/admin/waitlist/launch-email
 *
 * Endpoint admin (gated par un secret) qui envoie le mail de lancement
 * officiel à tous les inscrits de la waitlist qui ne l'ont pas encore
 * reçu. Idempotent via la colonne `waitlist.launch_email_sent_at` :
 * un deuxième appel ne réenverra pas aux gens déjà notifiés.
 *
 * C'est le tir PRÉCIS du jour J (job launchd `com.buupp.launch-email`).
 * Le cron quotidien `/api/admin/digest?severity=daily` sert de filet si
 * la machine est éteinte — même fonction, même idempotence, cf.
 * lib/waitlist/launch-email.ts.
 *
 * Auth : header `x-admin-secret` doit matcher l'env `BUUPP_ADMIN_SECRET`.
 * Si la variable n'est pas configurée côté serveur, l'endpoint répond
 * 503 (sécurité par défaut : pas d'env, pas d'accès).
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendPendingLaunchEmails } from "@/lib/waitlist/launch-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.BUUPP_ADMIN_SECRET;
  if (!expected) {
    console.error(
      "[/api/admin/waitlist/launch-email] BUUPP_ADMIN_SECRET non configuré côté serveur",
    );
    return NextResponse.json(
      { error: "admin_secret_not_configured" },
      { status: 503 },
    );
  }

  const provided = req.headers.get("x-admin-secret");
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const report = await sendPendingLaunchEmails(admin, { limit: 1000 });
  return NextResponse.json(report);
}
