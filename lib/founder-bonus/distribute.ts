/**
 * Backfill one-time du bonus fondateur. Idempotent : la RPC
 * apply_founder_signup_bonus garantit qu'un prospect déjà crédité est
 * ignoré (renvoie false) → ni broadcast ni email en double.
 *
 * Le broadcast est CIBLÉ (target_clerk_user_id) → seul le bénéficiaire le
 * voit dans sa cloche (cf. /api/me/notifications), conformément au choix
 * "uniquement les prospects qui ont reçu le bonus".
 *
 * Embed shape — `prospect_identity(email, prenom)` depuis `prospects` :
 * Dans ce repo, Supabase renvoie les jointures one-to-one (FK unique) comme
 * un OBJET (non un tableau). Confirmé par le commentaire explicite ligne 413
 * de app/api/admin/broadcasts/route.ts :
 *   « La jointure renvoie `prospects` comme objet (one-to-one via FK). »
 * et par la même pattern utilisée dans collectRecipients() :
 *   `(r.prospects as { clerk_user_id: string } | null)?.clerk_user_id`
 * On accède donc à `row.prospect_identity?.email` directement (pas [0]).
 *
 * Sémantique en cas d'échec après crédit : la RPC crédite et pose le flag
 * AVANT l'insertion du broadcast et l'envoi de l'email. Si le broadcast ou
 * l'email échoue ensuite, un re-run NE les rejoue PAS (la RPC renvoie false
 * car déjà crédité). L'opérateur doit donc inspecter les compteurs du
 * résultat ({ credited, broadcasted, emailed, errors }) : un écart
 * credited > broadcasted/emailed signale des notifications à reprendre
 * manuellement.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  sendFounderBonusEmail,
  type FounderBonusParams,
} from "@/lib/email/founder-bonus";

type Admin = SupabaseClient<Database>;

export type DistributeOptions = {
  confirm: boolean;
  /** Injection pour les tests ; par défaut l'email réel via Brevo. */
  sendEmail?: (email: string, params: FounderBonusParams) => Promise<void>;
};

export type DistributeResult = {
  eligible: number;
  credited: number;
  broadcasted: number;
  emailed: number;
  errors: number;
};

const BROADCAST = {
  title: "Votre bonus fondateur est arrivé 🎁",
  body:
    "Merci d'avoir rejoint BUUPP dès la liste d'attente ! Pour vous remercier, " +
    "nous venons de créditer 5,00 € de bonus fondateur sur votre portefeuille. " +
    "Il est dès maintenant disponible et retirable. Bienvenue parmi les tout " +
    "premiers membres.\n\nL'équipe BUUPP",
};

type EligibleRow = {
  id: string;
  clerk_user_id: string | null;
  // One-to-one embed : Supabase renvoie un objet, jamais un tableau
  // (cf. commentaire de module ci-dessus pour la source de vérité).
  prospect_identity: { email: string | null; prenom: string | null } | null;
};

export async function distributeFounderBonus(
  admin: Admin,
  opts: DistributeOptions,
): Promise<DistributeResult> {
  const sendEmail = opts.sendEmail ?? sendFounderBonusEmail;
  const result: DistributeResult = {
    eligible: 0,
    credited: 0,
    broadcasted: 0,
    emailed: 0,
    errors: 0,
  };

  // Éligibles : fondateurs pas encore crédités, avec email + clerk id.
  const { data, error } = await admin
    .from("prospects")
    .select("id, clerk_user_id, prospect_identity(email, prenom)")
    .eq("is_founder", true)
    .eq("founder_signup_bonus_applied", false);
  if (error) {
    console.error("[founder-bonus] éligibles read failed", error.message);
    return result;
  }
  const rows = (data ?? []) as unknown as EligibleRow[];
  result.eligible = rows.length;

  if (!opts.confirm) return result; // dry-run : on s'arrête après le compte.

  for (const row of rows) {
    const email = row.prospect_identity?.email ?? null;
    const clerkId = row.clerk_user_id;
    try {
      const { data: applied, error: rpcErr } = await admin.rpc(
        "apply_founder_signup_bonus",
        { p_prospect_id: row.id },
      );
      if (rpcErr) {
        console.error("[founder-bonus] rpc failed", row.id, rpcErr.message);
        result.errors += 1;
        continue;
      }
      if (applied !== true) continue; // déjà crédité / non éligible → skip.
      result.credited += 1;

      if (clerkId) {
        const { error: bErr } = await admin.from("admin_broadcasts").insert({
          title: BROADCAST.title,
          body: BROADCAST.body,
          audience: "prospects",
          created_by_admin_id: "system:founder-bonus",
          target_clerk_user_id: clerkId,
        });
        if (bErr) {
          console.error("[founder-bonus] broadcast insert failed", row.id, bErr.message);
          result.errors += 1;
        } else {
          result.broadcasted += 1;
        }
      } else {
        console.warn("[founder-bonus] crédité sans clerk_user_id, broadcast ignoré", row.id);
      }

      if (email) {
        await sendEmail(email, { prenom: row.prospect_identity?.prenom ?? null });
        result.emailed += 1;
      } else {
        console.warn("[founder-bonus] crédité sans email, email ignoré", row.id);
      }
    } catch (err) {
      console.error("[founder-bonus] unexpected error", row.id, err);
      result.errors += 1;
    }
  }

  return result;
}

export type LaunchDistributeResult =
  | { ran: false; reason: string }
  | ({ ran: true } & DistributeResult);

/**
 * Versement « au lancement officiel » — appelé chaque jour par le cron
 * /api/admin/digest (même piggyback que la bascule CNIL). Tant que
 * `app_config.launch_at` n'est pas atteint, ne fait RIEN. À partir du
 * lancement (décompte à zéro), distribue le bonus à tous les fondateurs
 * éligibles non encore crédités. Idempotent : le flag
 * `founder_signup_bonus_applied` empêche tout doublon, donc les runs
 * quotidiens suivants ne rattrapent que les nouveaux fondateurs.
 */
export async function distributeFounderBonusIfLaunched(
  admin: Admin,
): Promise<LaunchDistributeResult> {
  const { data: cfg, error } = await admin
    .from("app_config")
    .select("launch_at")
    .single();
  if (error || !cfg?.launch_at) {
    console.error("[founder-bonus] launch_at lookup failed", error?.message);
    return { ran: false, reason: "launch_at_unavailable" };
  }
  // Gate temporelle — pas avant la fin du décompte (launch_at).
  if (new Date(cfg.launch_at) > new Date()) {
    return { ran: false, reason: "before_launch" };
  }
  const result = await distributeFounderBonus(admin, { confirm: true });
  return { ran: true, ...result };
}
