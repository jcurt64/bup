/**
 * Cycle de vie du bonus fondateur 5 €.
 *
 * Deux étapes distinctes, volontairement séparées :
 *  - PROVISIONNEMENT : dès qu'un compte fondateur existe, on écrit la
 *    transaction `signup_bonus` en `pending`. Elle est visible dans le
 *    portefeuille mais exclue du solde (les agrégats filtrent
 *    `status = 'completed'`). Aucune notification à ce stade.
 *  - SIGNALEMENT : quand les conditions tombent (3 mois d'ancienneté du
 *    compte + au moins une sollicitation acceptée, avec `launch_at` pour
 *    plancher), le bonus devient « débloquable » et le prospect en est
 *    prévenu une seule fois (cloche + email). La règle elle-même vit
 *    exclusivement dans `founder_bonus_unlock_state` côté SQL.
 *
 * Le DÉBLOCAGE lui-même n'est PAS automatique : c'est au prospect de
 * récupérer son bonus depuis son portefeuille, via
 * POST /api/prospect/founder-bonus/claim → `claim_founder_signup_bonus`,
 * qui revérifie les conditions côté serveur. Rien ici ne crédite quoi que
 * ce soit.
 *
 * Sémantique en cas d'échec après signalement : la RPC pose le marqueur
 * `founder_bonus_unlockable_notified_at` AVANT l'insertion du broadcast et
 * l'envoi de l'email. Si l'un des deux échoue, un re-run ne les rejoue PAS
 * (le marqueur n'est plus nul). L'opérateur doit comparer les compteurs du
 * résultat : un écart `notifiable > broadcasted/emailed` signale des
 * notifications à reprendre.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  sendFounderBonusEmail,
  type FounderBonusParams,
} from "@/lib/email/founder-bonus";

type Admin = SupabaseClient<Database>;

export type ProvisionResult = {
  eligible: number;
  provisioned: number;
  errors: number;
};

export type NoticeResult = {
  notifiable: number;
  broadcasted: number;
  emailed: number;
  errors: number;
};

const BROADCAST = {
  title: "Votre bonus fondateur est débloquable 🎁",
  body:
    "Merci d'avoir rejoint BUUPP dès la liste d'attente ! Votre bonus " +
    "fondateur de 5,00 € est désormais débloquable : votre compte a plus " +
    "de trois mois et vous avez accepté au moins une sollicitation. " +
    "Rendez-vous dans votre portefeuille pour le récupérer — il rejoindra " +
    "alors votre solde disponible et sera retirable.\n\nL'équipe BUUPP",
};

/**
 * Écrit la transaction `pending` pour les fondateurs qui n'en ont pas
 * encore. Idempotent : la RPC repose sur le drapeau
 * `prospects.founder_signup_bonus_applied`.
 */
export async function provisionFounderBonuses(
  admin: Admin,
  opts: { confirm: boolean },
): Promise<ProvisionResult> {
  const result: ProvisionResult = { eligible: 0, provisioned: 0, errors: 0 };

  const { data, error } = await admin
    .from("prospects")
    .select("id")
    .eq("is_founder", true)
    .eq("founder_signup_bonus_applied", false);
  if (error) {
    console.error("[founder-bonus] éligibles read failed", error.message);
    return result;
  }
  const rows = data ?? [];
  result.eligible = rows.length;

  if (!opts.confirm) return result; // dry-run : on s'arrête après le compte.

  for (const row of rows) {
    const { data: provisioned, error: rpcErr } = await admin.rpc(
      "provision_founder_signup_bonus",
      { p_prospect_id: row.id },
    );
    if (rpcErr) {
      console.error("[founder-bonus] provision rpc failed", row.id, rpcErr.message);
      result.errors += 1;
      continue;
    }
    if (provisioned === true) result.provisioned += 1;
  }

  return result;
}

/**
 * Prévient les prospects dont le bonus vient de devenir débloquable
 * (cloche ciblée + email). Ne crédite rien : le déblocage reste une
 * action volontaire du prospect.
 */
export async function notifyUnlockableFounderBonuses(
  admin: Admin,
  opts?: { sendEmail?: (email: string, params: FounderBonusParams) => Promise<void> },
): Promise<NoticeResult> {
  const sendEmail = opts?.sendEmail ?? sendFounderBonusEmail;
  const result: NoticeResult = { notifiable: 0, broadcasted: 0, emailed: 0, errors: 0 };

  const { data, error } = await admin.rpc("flag_ripe_founder_bonuses_for_notice");
  if (error) {
    console.error("[founder-bonus] notice rpc failed", error.message);
    return result;
  }
  const rows = data ?? [];
  result.notifiable = rows.length;
  if (rows.length === 0) return result;

  console.log(`[founder-bonus] ${rows.length} bonus devenu(s) débloquable(s)`);

  for (const row of rows) {
    try {
      if (row.clerk_user_id) {
        const { error: bErr } = await admin.from("admin_broadcasts").insert({
          title: BROADCAST.title,
          body: BROADCAST.body,
          audience: "prospects",
          created_by_admin_id: "system:founder-bonus",
          target_clerk_user_id: row.clerk_user_id,
        });
        if (bErr) {
          console.error("[founder-bonus] broadcast insert failed", row.prospect_id, bErr.message);
          result.errors += 1;
        } else {
          result.broadcasted += 1;
        }
      } else {
        console.warn("[founder-bonus] débloquable sans clerk_user_id, broadcast ignoré", row.prospect_id);
      }

      if (row.email) {
        await sendEmail(row.email, { prenom: row.prenom ?? null });
        result.emailed += 1;
      } else {
        console.warn("[founder-bonus] débloquable sans email, email ignoré", row.prospect_id);
      }
    } catch (err) {
      console.error("[founder-bonus] unexpected error", row.prospect_id, err);
      result.errors += 1;
    }
  }

  return result;
}

/**
 * Point d'entrée unique : provisionne, puis prévient ceux dont le bonus
 * vient de devenir débloquable. Appelé par le cron quotidien et, en
 * lecture paresseuse, par les endpoints portefeuille — exactement comme
 * `settleRipeRelationsAndNotify`. Ne crédite jamais : seul le prospect
 * déclenche le déblocage.
 */
export async function syncFounderBonusesAndNotify(
  admin: Admin,
): Promise<{ provision: ProvisionResult; notice: NoticeResult }> {
  const provision = await provisionFounderBonuses(admin, { confirm: true });
  const notice = await notifyUnlockableFounderBonuses(admin);
  return { provision, notice };
}
