/**
 * Envoi du mail de lancement officiel aux inscrits de la liste d'attente.
 *
 * Logique partagée par deux déclencheurs, volontairement redondants :
 *   • POST /api/admin/waitlist/launch-email — le tir précis, appelé le
 *     jour J à l'heure dite (job launchd `com.buupp.launch-email`) ;
 *   • le cron quotidien `/api/admin/digest?severity=daily` (18h UTC) —
 *     FILET, pour le cas où la machine qui porte le job serait éteinte.
 *
 * La redondance est sans danger : l'envoi est idempotent par la colonne
 * `waitlist.launch_email_sent_at`, écrite après chaque succès. Un second
 * passage ne voit plus que les lignes restées en échec.
 *
 * Le filtrage des lignes fictives est fait par `collectWaitlistAudience`
 * (cf. lib/waitlist/test-accounts) : rien ne part vers une fixture, un
 * honeypot ou une adresse invalide.
 */

import type { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendWaitlistLaunched } from "@/lib/email/waitlist-launched";
import { collectWaitlistAudience } from "./recipients";

/** Envois menés de front. Assez pour être rapide, assez peu pour ne pas
 *  saturer l'API Brevo ni le temps d'exécution de la fonction. */
const BATCH_SIZE = 5;

export type LaunchEmailReport = {
  processed: number;
  failed: number;
  totalUnsent: number;
  skipped: number;
  failures: { id: string; email: string; reason: string }[];
};

export async function sendPendingLaunchEmails(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  opts: { limit?: number } = {},
): Promise<LaunchEmailReport> {
  const { recipients, excluded } = await collectWaitlistAudience(admin, {
    onlyNotLaunchEmailed: true,
    limit: opts.limit ?? 1000,
  });

  // On ne touche PAS aux lignes écartées : leur `launch_email_sent_at`
  // reste nul (aucun mail n'est parti), elles sont simplement absentes de
  // l'envoi et décomptées du restant renvoyé plus bas.
  if (excluded.length > 0) {
    console.log(
      `[waitlist/launch-email] ${excluded.length} ligne(s) fictive(s) ignorée(s)`,
    );
  }

  if (recipients.length === 0) {
    return { processed: 0, failed: 0, totalUnsent: 0, skipped: excluded.length, failures: [] };
  }

  let processed = 0;
  let failed = 0;
  const failures: LaunchEmailReport["failures"] = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        await sendWaitlistLaunched({ email: row.email, prenom: row.prenom });
        // Marquage idempotent : on n'écrit qu'après succès de l'envoi.
        const { error: updErr } = await admin
          .from("waitlist")
          .update({ launch_email_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        if (updErr) {
          // Mail parti, mais flag pas écrit : risque de doublon au
          // passage suivant. On log et on compte l'envoi comme réussi —
          // mieux vaut un éventuel doublon qu'un faux échec.
          console.error(
            `[waitlist/launch-email] flag update failed for ${row.email}`,
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
  // savoir s'il faut repasser). Les lignes fictives n'y figurent pas :
  // sinon le compteur ne tomberait jamais à zéro.
  const { recipients: remaining, excluded: remainingExcluded } =
    await collectWaitlistAudience(admin, { onlyNotLaunchEmailed: true });

  return {
    processed,
    failed,
    totalUnsent: remaining.length,
    skipped: remainingExcluded.length,
    failures: failures.slice(0, 50),
  };
}

/** Une semaine : au-delà, le filet se tait (cf. `sendLaunchEmailsIfDue`). */
const BACKSTOP_WINDOW_MS = 7 * 24 * 3_600_000;

/**
 * Filet du cron quotidien : n'envoie que dans la semaine qui suit
 * `app_config.launch_at`, et seulement une fois cette date passée.
 *
 * Les deux bornes comptent. Sans la borne basse, le mail « c'est ouvert »
 * partirait avant l'ouverture. Sans la borne haute, une inscription
 * tardive sur la liste d'attente recevrait des mois plus tard un mail
 * d'annonce de lancement — absurde.
 *
 * Renvoie `null` quand il n'y avait rien à faire.
 */
export async function sendLaunchEmailsIfDue(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  now: number = Date.now(),
): Promise<LaunchEmailReport | null> {
  const { data, error } = await admin
    .from("app_config")
    .select("launch_at")
    .maybeSingle();
  if (error) {
    console.error("[waitlist/launch-email] lecture launch_at échouée", error);
    return null;
  }
  const launchAt = data?.launch_at ? Date.parse(data.launch_at) : NaN;
  if (!Number.isFinite(launchAt)) return null;
  if (now < launchAt || now > launchAt + BACKSTOP_WINDOW_MS) return null;

  const report = await sendPendingLaunchEmails(admin);
  if (report.processed === 0 && report.failed === 0) return null;
  console.log(
    `[waitlist/launch-email] filet quotidien : ${report.processed} envoyé(s), ${report.failed} échec(s), ${report.totalUnsent} restant(s)`,
  );
  return report;
}
