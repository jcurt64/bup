/**
 * Escalade « non-réponse prospect ».
 *
 * Un professionnel signale un prospect injoignable via l'évaluation
 * « non atteint » (cf. /api/pro/contacts/[relationId]/evaluation). Chaque
 * signalement compté = 1 strike (tous pros confondus, 1 contact = 1 fois).
 *
 * Paliers (appliqués une seule fois via `prospects.non_response_level`) :
 *   2 strikes → signalement (admin event + rappel courtois)
 *   3 strikes → malus BUUPP Score persistant (-100 pts) + message courtois
 *   4 strikes → restriction d'acceptation 2 mois + message courtois
 *
 * À l'expiration de la restriction → remise à zéro complète (ardoise propre).
 *
 * Ce module isole : (a) la logique pure (testable) et (b) les wrappers qui
 * touchent la base (appelés par les routes).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { recordEvent } from "@/lib/admin/events/record";
import { computeAndPersistProspectScore } from "@/lib/prospect/score";

export const NON_RESPONSE_THRESHOLDS = {
  signalement: 2,
  scoreMalus: 3,
  restriction: 4,
} as const;

export const SCORE_MALUS_POINTS = 100;
export const RESTRICTION_MONTHS = 2;

type Step = 2 | 3 | 4;

/** Quels paliers sont nouvellement franchis pour ce niveau de strikes,
 *  compte tenu du plus haut palier déjà appliqué (`priorLevel`). Pur. */
export function escalationSteps(strikes: number, priorLevel: number): Step[] {
  const steps: Step[] = [];
  if (strikes >= NON_RESPONSE_THRESHOLDS.signalement && priorLevel < 2) steps.push(2);
  if (strikes >= NON_RESPONSE_THRESHOLDS.scoreMalus && priorLevel < 3) steps.push(3);
  if (strikes >= NON_RESPONSE_THRESHOLDS.restriction && priorLevel < 4) steps.push(4);
  return steps;
}

/** Date de fin de restriction = maintenant + RESTRICTION_MONTHS (calendaire). */
export function restrictionUntil(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCMonth(d.getUTCMonth() + RESTRICTION_MONTHS);
  return d;
}

/** La restriction est-elle échue ? `null`/non parsable ⇒ false (pas de restriction). */
export function isRestrictionExpired(
  untilIso: string | null | undefined,
  now: Date,
): boolean {
  if (!untilIso) return false;
  const ts = Date.parse(untilIso);
  if (Number.isNaN(ts)) return false;
  return ts <= now.getTime();
}

/** ISO → JJ/MM/AAAA (UTC), pour les messages. */
export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ─── Messages courtois ──────────────────────────────────────────────────────

const MSG_SIGNALEMENT = {
  title: "Oups — un pro n'a pas pu vous joindre",
  body:
    "Bonjour,\n\n" +
    "Il semblerait qu'un professionnel n'ait pas réussi à vous contacter " +
    "après votre acceptation. Pas de souci — un imprévu, ça arrive !\n\n" +
    "Petit rappel sur le fonctionnement de BUUPP : quand vous acceptez une " +
    "sollicitation, le professionnel paie pour pouvoir vous joindre, et vous " +
    "touchez votre rémunération. C'est un échange qui marche dans les deux " +
    "sens.\n\n" +
    "À l'avenir, pensez à répondre aux sollicitations que vous avez acceptées " +
    "(email, SMS ou téléphone) — même un simple « non merci » est mieux qu'un " +
    "silence. Merci de votre attention,\n" +
    "L'équipe BUUPP",
};

const MSG_SCORE_MALUS = {
  title: "Votre BUUPP Score a été ajusté",
  body:
    "Bonjour,\n\n" +
    "Nous avons légèrement ajusté votre BUUPP Score à la suite de plusieurs " +
    "sollicitations que vous aviez acceptées mais restées sans réponse.\n\n" +
    "Rien de définitif, et aucun reproche : en répondant aux prochaines " +
    "sollicitations que vous acceptez, votre score remontera naturellement. " +
    "Notre objectif est simplement de préserver un service de qualité, autant " +
    "pour vous que pour les professionnels.\n\n" +
    "Merci de votre compréhension,\n" +
    "L'équipe BUUPP",
};

function msgRestriction(untilIso: string) {
  const until = formatDateFr(untilIso);
  return {
    title: "Acceptation de sollicitations mise en pause",
    body:
      "Bonjour,\n\n" +
      "Pour préserver la qualité du service pour tout le monde, l'acceptation " +
      "de nouvelles sollicitations est mise en pause sur votre compte pendant " +
      `${RESTRICTION_MONTHS} mois, jusqu'au ${until}.\n\n` +
      "Cette pause fait suite à plusieurs sollicitations acceptées restées " +
      "sans réponse. Vous pourrez de nouveau accepter des sollicitations à " +
      "cette date — et entre-temps, vous restez libre de compléter votre " +
      "profil et de consulter votre espace.\n\n" +
      "Merci de votre compréhension,\n" +
      "L'équipe BUUPP",
  };
}

const MSG_RESET = {
  title: "Bon retour — vous pouvez de nouveau accepter",
  body:
    "Bonjour,\n\n" +
    "Bonne nouvelle : la pause sur votre compte est terminée. Vous pouvez de " +
    "nouveau accepter des sollicitations, avec une ardoise repartie à zéro.\n\n" +
    "À très vite sur BUUPP !\n" +
    "L'équipe BUUPP",
};

/** Message court renvoyé au prospect quand il tente d'accepter pendant la
 *  restriction (surfacé par le front à côté du bouton « Accepter »). */
export function acceptRestrictedMessage(untilIso: string): string {
  return (
    "L'acceptation de sollicitations est temporairement en pause sur votre " +
    `compte, jusqu'au ${formatDateFr(untilIso)}, à la suite de plusieurs ` +
    "sollicitations acceptées restées sans réponse. Vous pourrez de nouveau " +
    "accepter des sollicitations à cette date. Merci de votre compréhension."
  );
}

// ─── Wrappers base de données ───────────────────────────────────────────────

type Admin = SupabaseClient<Database>;

async function insertBroadcast(
  admin: Admin,
  targetClerkUserId: string,
  msg: { title: string; body: string },
): Promise<void> {
  const { error } = await admin.from("admin_broadcasts").insert({
    title: msg.title,
    body: msg.body,
    audience: "prospects",
    created_by_admin_id: "system:non-response",
    target_clerk_user_id: targetClerkUserId,
  });
  if (error) {
    console.error("[non-response] broadcast insert failed", error.message);
  }
}

/**
 * Applique l'escalade après qu'un NOUVEAU strike a été compté pour ce prospect.
 * Lit l'état courant, applique les paliers nouvellement franchis (idempotent),
 * persiste, recompute le score si un malus est appliqué, émet events + messages.
 */
export async function applyNonResponseEscalation(
  admin: Admin,
  prospectId: string,
  relationId: string | null,
): Promise<void> {
  const { data: row, error } = await admin
    .from("prospects")
    .select("non_response_strikes, non_response_level, score_malus, clerk_user_id")
    .eq("id", prospectId)
    .maybeSingle();
  if (error || !row) {
    console.error("[non-response] prospect lookup failed", error?.message);
    return;
  }

  const strikes = row.non_response_strikes ?? 0;
  const level = row.non_response_level ?? 0;
  const steps = escalationSteps(strikes, level);
  if (steps.length === 0) return;

  const now = new Date();
  const patch: Database["public"]["Tables"]["prospects"]["Update"] = {
    non_response_level: steps[steps.length - 1],
  };
  let appliedScoreMalus = false;
  let restrictionIso: string | null = null;

  if (steps.includes(3)) {
    patch.score_malus = SCORE_MALUS_POINTS;
    appliedScoreMalus = true;
  }
  if (steps.includes(4)) {
    restrictionIso = restrictionUntil(now).toISOString();
    patch.accept_restricted_until = restrictionIso;
  }

  const { error: upErr } = await admin
    .from("prospects")
    .update(patch)
    .eq("id", prospectId);
  if (upErr) {
    console.error("[non-response] prospect update failed", upErr.message);
    return;
  }

  // Recompute du score pour matérialiser le malus (le calcul soustrait
  // désormais `score_malus`).
  if (appliedScoreMalus) {
    try {
      await computeAndPersistProspectScore(admin, prospectId);
    } catch (e) {
      console.warn("[non-response] score recompute failed", e);
    }
  }

  const targetUserId = row.clerk_user_id ?? null;
  for (const step of steps) {
    if (step === 2) {
      void recordEvent({
        type: "prospect.non_atteint_threshold",
        severity: "warning",
        prospectId,
        relationId,
        payload: { strikes, threshold: NON_RESPONSE_THRESHOLDS.signalement },
      });
      if (targetUserId) await insertBroadcast(admin, targetUserId, MSG_SIGNALEMENT);
    } else if (step === 3) {
      void recordEvent({
        type: "prospect.non_response_score_penalty",
        severity: "warning",
        prospectId,
        relationId,
        payload: { strikes, malus: SCORE_MALUS_POINTS },
      });
      if (targetUserId) await insertBroadcast(admin, targetUserId, MSG_SCORE_MALUS);
    } else {
      void recordEvent({
        type: "prospect.non_response_accept_restricted",
        severity: "warning",
        prospectId,
        relationId,
        payload: { strikes, restrictedUntil: restrictionIso, months: RESTRICTION_MONTHS },
      });
      if (targetUserId && restrictionIso) {
        await insertBroadcast(admin, targetUserId, msgRestriction(restrictionIso));
      }
    }
  }
}

/**
 * Si la restriction d'acceptation du prospect est échue, remet le compteur à
 * zéro (ardoise propre), lève le malus, recompute le score, informe le prospect.
 * Retourne true si une remise à zéro a eu lieu.
 *
 * `row` peut être fourni pour éviter un round-trip (chemin accept). Sinon on lit.
 */
export async function liftExpiredNonResponseRestriction(
  admin: Admin,
  prospectId: string,
  row?: { accept_restricted_until: string | null; clerk_user_id: string | null },
): Promise<boolean> {
  let data = row ?? null;
  if (!data) {
    const res = await admin
      .from("prospects")
      .select("accept_restricted_until, clerk_user_id")
      .eq("id", prospectId)
      .maybeSingle();
    data = res.data ?? null;
  }
  if (!data) return false;
  if (!isRestrictionExpired(data.accept_restricted_until, new Date())) return false;

  const { error } = await admin
    .from("prospects")
    .update({
      non_response_strikes: 0,
      non_response_level: 0,
      score_malus: 0,
      accept_restricted_until: null,
    })
    .eq("id", prospectId);
  if (error) {
    console.error("[non-response] reset failed", error.message);
    return false;
  }

  try {
    await computeAndPersistProspectScore(admin, prospectId);
  } catch (e) {
    console.warn("[non-response] score recompute (reset) failed", e);
  }

  if (data.clerk_user_id) await insertBroadcast(admin, data.clerk_user_id, MSG_RESET);
  return true;
}

/**
 * Balaye tous les prospects dont la restriction d'acceptation est échue et
 * remet leur ardoise à zéro. Appelé par le cron quotidien (pour que le matching
 * redevienne équitable même si le prospect ne revient pas de lui-même).
 * Retourne le nombre de remises à zéro effectuées.
 */
export async function sweepExpiredNonResponseRestrictions(admin: Admin): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("prospects")
    .select("id, accept_restricted_until, clerk_user_id")
    .not("accept_restricted_until", "is", null)
    .lte("accept_restricted_until", nowIso);
  if (error || !data) {
    if (error) console.error("[non-response] sweep query failed", error.message);
    return 0;
  }
  let reset = 0;
  for (const row of data) {
    const did = await liftExpiredNonResponseRestriction(admin, row.id, {
      accept_restricted_until: row.accept_restricted_until,
      clerk_user_id: row.clerk_user_id,
    });
    if (did) reset += 1;
  }
  return reset;
}
