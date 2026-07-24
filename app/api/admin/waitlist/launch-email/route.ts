/**
 * POST /api/admin/waitlist/launch-email
 *
 * Endpoint admin (gated par un secret) qui envoie le mail de lancement
 * officiel à tous les inscrits de la waitlist qui ne l'ont pas encore
 * reçu. Idempotent via la colonne `waitlist.launch_email_sent_at` :
 * un deuxième appel ne réenverra pas aux gens déjà notifiés.
 *
 * Auth : header `x-admin-secret` doit matcher l'env `BUUPP_ADMIN_SECRET`.
 * Si la variable n'est pas configurée côté serveur, l'endpoint répond
 * 503 (sécurité par défaut : pas d'env, pas d'accès).
 *
 * Concurrence d'envoi : batch de 5 mails en parallèle pour éviter de
 * saturer le SMTP tout en gardant un débit raisonnable. Chaque succès
 * marque immédiatement la ligne `launch_email_sent_at = now()` ; les
 * échecs laissent la ligne intacte → un re-call rattrapera.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendWaitlistLaunched } from "@/lib/email/waitlist-launched";
import { collectWaitlistAudience } from "@/lib/waitlist/recipients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 5;

type WaitlistRow = {
  id: string;
  email: string;
  prenom: string;
};

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

  // Lecture des inscrits non encore notifiés, débarrassée des lignes
  // fictives (fixtures de parrainage, honeypot, diagnostics) et des
  // adresses invalides — cf. lib/waitlist/test-accounts. On limite la
  // fournée à 1000 par appel (re-call possible) — évite les timeouts si
  // la liste grossit sans plafond.
  const { recipients, excluded } = await collectWaitlistAudience(admin, {
    onlyNotLaunchEmailed: true,
    limit: 1000,
  });

  // On ne touche PAS aux lignes écartées : leur `launch_email_sent_at`
  // reste nul (aucun mail n'est parti), elles sont simplement absentes de
  // l'envoi et décomptées du restant renvoyé plus bas.
  if (excluded.length > 0) {
    console.log(
      `[/api/admin/waitlist/launch-email] ${excluded.length} ligne(s) fictive(s) ignorée(s)`,
    );
  }

  const rows = recipients as WaitlistRow[];
  if (rows.length === 0) {
    return NextResponse.json({ processed: 0, failed: 0, totalUnsent: 0 });
  }

  let processed = 0;
  let failed = 0;
  const failures: { id: string; email: string; reason: string }[] = [];

  // Traitement par batches de BATCH_SIZE en parallèle.
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        await sendWaitlistLaunched({ email: row.email, prenom: row.prenom });
        // Marquage idempotent : on n'écrit qu'après succès SMTP.
        const { error: updErr } = await admin
          .from("waitlist")
          .update({ launch_email_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        if (updErr) {
          // Mail parti, mais flag pas écrit : risque de doublon en
          // re-call. On log mais on considère l'envoi réussi (mieux vaut
          // un éventuel doublon qu'un faux échec).
          console.error(
            `[/api/admin/waitlist/launch-email] flag update failed for ${row.email}`,
            updErr,
          );
        }
        return row.id;
      }),
    );

    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        processed += 1;
      } else {
        failed += 1;
        const reason =
          r.reason instanceof Error
            ? `${r.reason.name}: ${r.reason.message}`
            : String(r.reason);
        failures.push({ id: batch[idx].id, email: batch[idx].email, reason });
      }
    });
  }

  // Compte ce qu'il reste de destinataires RÉELS non notifiés (utile pour
  // savoir s'il faut re-call). Les lignes fictives n'y figurent pas : sinon
  // le compteur ne tomberait jamais à zéro.
  const { recipients: remaining, excluded: remainingExcluded } =
    await collectWaitlistAudience(admin, { onlyNotLaunchEmailed: true });

  return NextResponse.json({
    processed,
    failed,
    totalUnsent: remaining.length,
    skipped: remainingExcluded.length,
    failures: failures.slice(0, 50),
  });
}
