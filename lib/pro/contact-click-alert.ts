/**
 * Anti-abus contact : rappelle gentiment au PRO le cadre BUUPP sur l'usage
 * des données quand il a cliqué ≥ REPEAT_THRESHOLD fois sur les icônes de
 * contact (téléphone / e-mail / SMS / WhatsApp) d'un même
 * prospect en 24 h, tous canaux confondus.
 *
 * Déclenché via `after()` depuis `POST /api/pro/contacts/[relationId]/contact-click`
 * (exécution post-réponse garantie sur Vercel), juste après l'insertion du
 * clic dans `pro_contact_clicks` — le clic courant est donc déjà compté.
 * L'e-mail du pro est fourni par la route (issu de Clerk via currentUser),
 * car `pro_accounts` ne stocke pas l'email.
 *
 * Anti-spam : 1 seul mail par couple (pro × prospect) par 24 h. La
 * déduplication est vérifiée en LECTURE SEULE puis enregistrée UNIQUEMENT
 * après un envoi réussi (sinon un envoi échoué consommerait le jeton et
 * bloquerait toute relance pendant 24 h). Clé versionnée.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { sendProAccessReminder } from "@/lib/email/pro-access-reminder";

/** Seuil de clics de contact sur 24 h (tous canaux) qui déclenche le mail. */
export const REPEAT_THRESHOLD = 3;
const WINDOW_MS = 24 * 3_600_000;
const DEDUP_WINDOW_SEC = 24 * 3600;
const DEDUP_WINDOW_MS = DEDUP_WINDOW_SEC * 1000;

export async function maybeSendProContactAlert(
  admin: SupabaseClient<Database>,
  params: { proId: string; prospectId: string; proEmail: string | null },
): Promise<void> {
  const { proId, prospectId, proEmail } = params;
  const tag = `[contact-alert] pro=${proId.slice(0, 8)} prospect=${prospectId.slice(0, 8)}`;
  // Override de TEST : si défini, le mail part vers cette adresse au lieu de
  // celle (potentiellement fictive) du compte pro. À retirer en prod.
  const overrideEmail = process.env.CONTACT_ALERT_OVERRIDE_EMAIL?.trim() || null;
  const recipient = overrideEmail || proEmail;
  if (!recipient) {
    console.warn(`${tag} — pas d'email pro (et pas d'override), abandon`);
    return;
  }
  if (overrideEmail) {
    console.log(`${tag} — override TEST actif → envoi vers ${overrideEmail}`);
  }
  try {
    // 1. Nombre de clics de contact (tous canaux) sur ce prospect / 24 h
    //    (le clic courant est déjà inséré, donc inclus).
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count } = await admin
      .from("pro_contact_clicks")
      .select("id", { count: "exact", head: true })
      .eq("pro_account_id", proId)
      .eq("prospect_id", prospectId)
      .gte("created_at", cutoff);
    const clicks = count ?? 0;
    console.log(`${tag} — ${clicks} clic(s) contact / 24h (seuil ${REPEAT_THRESHOLD})`);
    if (clicks < REPEAT_THRESHOLD) return;

    // 2. Déduplication — LECTURE SEULE : un mail a-t-il déjà été envoyé
    //    pour ce couple dans les 24 h ?
    const dedupKey = `contact-alert:v1:${proId}:${prospectId}`;
    const { data: ded } = await admin
      .from("rate_limits")
      .select("window_start_at")
      .eq("key", dedupKey)
      .maybeSingle();
    if (ded && Date.parse(ded.window_start_at) >= Date.now() - DEDUP_WINDOW_MS) {
      console.log(`${tag} — déjà alerté dans les 24h, skip`);
      return;
    }

    // 3. Personnalisation : raison sociale du pro + prénom du contact.
    const [proRes, identRes] = await Promise.all([
      admin.from("pro_accounts").select("raison_sociale").eq("id", proId).maybeSingle(),
      admin
        .from("prospect_identity")
        .select("prenom")
        .eq("prospect_id", prospectId)
        .maybeSingle(),
    ]);

    const sent = await sendProAccessReminder({
      email: recipient,
      raisonSociale: proRes.data?.raison_sociale ?? null,
      contactPrenom: identRes.data?.prenom ?? null,
      accessCount: clicks,
    });

    // 4. On n'enregistre la dédup qu'APRÈS un envoi réussi — checkRateLimit
    //    crée/réinitialise la ligne `rate_limits` (window_start_at = now).
    if (sent) {
      await checkRateLimit({ key: dedupKey, limit: 1, windowSec: DEDUP_WINDOW_SEC });
      console.log(`${tag} — mail envoyé + dédup enregistrée`);
    } else {
      console.warn(`${tag} — envoi échoué, dédup NON enregistrée (relance possible)`);
    }
  } catch (err) {
    console.error(`${tag} — exception`, err);
  }
}
