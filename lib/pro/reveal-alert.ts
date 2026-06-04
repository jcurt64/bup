/**
 * Anti-accès-répétés : rappelle gentiment au PRO le cadre BUUPP sur l'usage
 * des données quand il a ouvert le détail d'un même contact ≥ REPEAT_THRESHOLD
 * fois en 24 h.
 *
 * Déclenché via `after()` depuis `GET /api/pro/contacts/[relationId]/details`
 * (exécution post-réponse garantie sur Vercel), juste après l'insertion de
 * la ligne d'audit `pro_contact_reveals` (field='details') — la ligne
 * courante est donc déjà comptée. L'e-mail du pro est fourni par la route
 * (issu de Clerk via currentUser), car `pro_accounts` ne stocke pas l'email.
 *
 * Anti-spam : 1 seul mail par couple (pro × prospect) par 24 h. La
 * déduplication est vérifiée en LECTURE SEULE puis enregistrée UNIQUEMENT
 * après un envoi réussi (sinon un envoi échoué consommerait le jeton et
 * bloquerait toute relance pendant 24 h). Clé versionnée pour pouvoir
 * repartir d'un état propre.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { sendProAccessReminder } from "@/lib/email/pro-access-reminder";

/** Seuil d'ouvertures du détail sur 24 h qui déclenche le mail. */
export const REPEAT_THRESHOLD = 3;
const WINDOW_MS = 24 * 3_600_000;
const DEDUP_WINDOW_SEC = 24 * 3600;
const DEDUP_WINDOW_MS = DEDUP_WINDOW_SEC * 1000;

export async function maybeSendProspectRevealAlert(
  admin: SupabaseClient<Database>,
  params: { proId: string; prospectId: string; proEmail: string | null },
): Promise<void> {
  const { proId, prospectId, proEmail } = params;
  const tag = `[reveal-alert] pro=${proId.slice(0, 8)} prospect=${prospectId.slice(0, 8)}`;
  if (!proEmail) {
    console.warn(`${tag} — pas d'email pro, abandon`);
    return;
  }
  try {
    // 1. Toutes les relations de ce couple (pro, prospect).
    const { data: rels } = await admin
      .from("relations")
      .select("id")
      .eq("pro_account_id", proId)
      .eq("prospect_id", prospectId);
    const relIds = (rels ?? []).map((r) => r.id);
    if (relIds.length === 0) {
      console.warn(`${tag} — aucune relation, abandon`);
      return;
    }

    // 2. Nombre d'ouvertures du DÉTAIL sur 24 h (ligne courante incluse).
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count } = await admin
      .from("pro_contact_reveals")
      .select("id", { count: "exact", head: true })
      .eq("pro_account_id", proId)
      .eq("field", "details")
      .in("relation_id", relIds)
      .gte("revealed_at", cutoff);
    const opens = count ?? 0;
    console.log(`${tag} — ${opens} ouverture(s) détail / 24h (seuil ${REPEAT_THRESHOLD})`);
    if (opens < REPEAT_THRESHOLD) return;

    // 3. Déduplication — LECTURE SEULE : un mail a-t-il déjà été envoyé
    //    pour ce couple dans les 24 h ? (clé versionnée v2)
    const dedupKey = `reveal-alert:v2:${proId}:${prospectId}`;
    const { data: ded } = await admin
      .from("rate_limits")
      .select("window_start_at")
      .eq("key", dedupKey)
      .maybeSingle();
    if (ded && Date.parse(ded.window_start_at) >= Date.now() - DEDUP_WINDOW_MS) {
      console.log(`${tag} — déjà alerté dans les 24h, skip`);
      return;
    }

    // 4. Personnalisation : raison sociale du pro + prénom du contact.
    const [proRes, identRes] = await Promise.all([
      admin.from("pro_accounts").select("raison_sociale").eq("id", proId).maybeSingle(),
      admin
        .from("prospect_identity")
        .select("prenom")
        .eq("prospect_id", prospectId)
        .maybeSingle(),
    ]);

    const sent = await sendProAccessReminder({
      email: proEmail,
      raisonSociale: proRes.data?.raison_sociale ?? null,
      contactPrenom: identRes.data?.prenom ?? null,
      accessCount: opens,
    });

    // 5. On n'enregistre la dédup qu'APRÈS un envoi réussi — checkRateLimit
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
