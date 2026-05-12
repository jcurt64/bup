/**
 * Bascule automatique du régime de consentement au tracking email
 * — CNIL n° 2026-042, échéance du 14 juillet 2026.
 *
 * Pendant la période de transition (jusqu'au 14 juillet 2026 inclus), le
 * default DB de `email_tracking_consent` est `true` : tout utilisateur
 * non opposé reste tracké. Après l'échéance, ce régime devient illégal
 * — il faut un consentement explicite et documenté.
 *
 * Cette fonction est appelée chaque jour par le cron `/api/admin/digest`
 * (qui tourne déjà à 18:00 UTC). Le 15 juillet 2026 et après, si la
 * bascule n'a pas encore été appliquée, on remet à `false` tous les
 * utilisateurs dont le consentement n'a JAMAIS été explicitement
 * documenté (`email_tracking_consent_given_at IS NULL`). Les utilisateurs
 * ayant cliqué le toggle UI ou le lien "Réactiver le suivi" depuis un
 * email gardent leur état `true`.
 *
 * L'idempotence est garantie par un event `system.cnil_bascule_applied`
 * inséré dans `admin_events` au premier run — on check sa présence avant
 * d'agir. La bascule du DEFAULT de la colonne (ALTER TABLE) n'est PAS
 * faite ici (DDL risqué depuis Node) — c'est une migration SQL séparée
 * à appliquer manuellement le 14 juillet (cf. supabase/migrations/...
 * _cnil_bascule_default_false.sql).
 */

import type { createSupabaseAdminClient } from "@/lib/supabase/server";
import { recordEvent } from "@/lib/admin/events/record";

/** Date pivot. La bascule fire à partir de minuit UTC ce jour-là (inclus). */
const BASCULE_DATE_UTC = new Date("2026-07-15T00:00:00.000Z");

/** Type de l'event admin posé une fois la bascule appliquée. */
const EVENT_TYPE = "system.cnil_bascule_applied";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export async function applyCnilBasculeIfDue(admin: AdminClient): Promise<{
  applied: boolean;
  reason?: string;
  prospectsUpdated?: number;
  prosUpdated?: number;
}> {
  // Gate temporelle — pas avant le 15 juillet 2026.
  const now = new Date();
  if (now < BASCULE_DATE_UTC) {
    return { applied: false, reason: "before_bascule_date" };
  }

  // Gate idempotence — si on a déjà posé l'event "applied", on sort.
  const { data: existing, error: lookupErr } = await admin
    .from("admin_events")
    .select("id")
    .eq("type", EVENT_TYPE)
    .limit(1);
  if (lookupErr) {
    console.error("[cnil/bascule] event lookup failed", lookupErr);
    return { applied: false, reason: "lookup_failed" };
  }
  if (existing && existing.length > 0) {
    return { applied: false, reason: "already_applied" };
  }

  // Reset des prospects sans consentement explicite. Le filter
  // `consent_given_at IS NULL` préserve ceux qui ont cliqué le toggle UI
  // ou le lien "Réactiver" depuis un email.
  const { count: prospectsUpdated, error: pErr } = await admin
    .from("prospect_identity")
    .update({ email_tracking_consent: false }, { count: "exact" })
    .eq("email_tracking_consent", true)
    .is("email_tracking_consent_given_at", null);
  if (pErr) {
    console.error("[cnil/bascule] prospect update failed", pErr);
    return { applied: false, reason: "prospect_update_failed" };
  }

  // Reset des pros — même logique.
  const { count: prosUpdated, error: proErr } = await admin
    .from("pro_accounts")
    .update({ email_tracking_consent: false }, { count: "exact" })
    .eq("email_tracking_consent", true)
    .is("email_tracking_consent_given_at", null);
  if (proErr) {
    console.error("[cnil/bascule] pro update failed", proErr);
    return { applied: false, reason: "pro_update_failed" };
  }

  // Marque la bascule comme appliquée — idempotence pour les runs suivants.
  // Sévérité `info` pour qu'elle apparaisse dans le digest quotidien
  // (premier signal admin que la bascule a tourné). Payload détaille les
  // compteurs pour audit.
  try {
    await recordEvent({
      type: EVENT_TYPE,
      severity: "info",
      payload: {
        prospects_updated: prospectsUpdated ?? 0,
        pros_updated: prosUpdated ?? 0,
        applied_at: now.toISOString(),
        cnil_reference: "Recommandation n° 2026-042",
      },
    });
  } catch (err) {
    // Si recordEvent plante on a un problème de réentrée potentiel au
    // prochain run (la bascule re-tournerait). Mais la reset est
    // idempotente côté data (les rows déjà à false ne sont pas
    // re-touchées → count = 0), donc pas de dégât.
    console.error("[cnil/bascule] event record failed", err);
  }

  return {
    applied: true,
    prospectsUpdated: prospectsUpdated ?? 0,
    prosUpdated: prosUpdated ?? 0,
  };
}
