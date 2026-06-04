/**
 * Anti-accès-répétés : rappelle gentiment au PRO le cadre BUUPP sur l'usage
 * des données quand il a ouvert le détail d'un même contact ≥ REPEAT_THRESHOLD
 * fois en 24 h.
 *
 * Déclenché (fire-and-forget) à chaque ouverture du détail côté pro
 * (`GET /api/pro/contacts/[relationId]/details`), juste après l'insertion
 * de la ligne d'audit `pro_contact_reveals` (field='details') — la ligne
 * courante est donc déjà comptée. L'e-mail du pro est fourni par la route
 * (issu de Clerk via currentUser), car `pro_accounts` ne stocke pas l'email.
 *
 * Anti-spam : 1 seul mail par couple (pro × prospect) par 24 h, via la
 * table `rate_limits` (clé dédiée). Si la base est down, checkRateLimit
 * fail-open → au pire un mail de plus, jamais bloquant.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { sendProAccessReminder } from "@/lib/email/pro-access-reminder";

/** Seuil d'ouvertures du détail sur 24 h qui déclenche le mail. */
export const REPEAT_THRESHOLD = 3;
const WINDOW_MS = 24 * 3_600_000;
const DEDUP_WINDOW_SEC = 24 * 3600;

export async function maybeSendProspectRevealAlert(
  admin: SupabaseClient<Database>,
  params: { proId: string; prospectId: string; proEmail: string | null },
): Promise<void> {
  const { proId, prospectId, proEmail } = params;
  // Sans adresse du pro, rien à envoyer.
  if (!proEmail) return;
  try {
    // 1. Toutes les relations de ce couple (pro, prospect) — le seuil se
    //    raisonne par prospect, pas par campagne.
    const { data: rels } = await admin
      .from("relations")
      .select("id")
      .eq("pro_account_id", proId)
      .eq("prospect_id", prospectId);
    const relIds = (rels ?? []).map((r) => r.id);
    if (relIds.length === 0) return;

    // 2. Nombre d'ouvertures du DÉTAIL sur 24 h (la ligne courante incluse).
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count } = await admin
      .from("pro_contact_reveals")
      .select("id", { count: "exact", head: true })
      .eq("pro_account_id", proId)
      .eq("field", "details")
      .in("relation_id", relIds)
      .gte("revealed_at", cutoff);
    if ((count ?? 0) < REPEAT_THRESHOLD) return;

    // 3. Déduplication : 1 mail / couple (pro, prospect) / 24 h.
    const dedup = await checkRateLimit({
      key: `reveal-alert:${proId}:${prospectId}`,
      limit: 1,
      windowSec: DEDUP_WINDOW_SEC,
    });
    if (!dedup.allowed) return;

    // 4. Personnalisation : raison sociale du pro + prénom du contact (le
    //    pro y a déjà accès, simple repère).
    const [proRes, identRes] = await Promise.all([
      admin.from("pro_accounts").select("raison_sociale").eq("id", proId).maybeSingle(),
      admin
        .from("prospect_identity")
        .select("prenom")
        .eq("prospect_id", prospectId)
        .maybeSingle(),
    ]);

    await sendProAccessReminder({
      email: proEmail,
      raisonSociale: proRes.data?.raison_sociale ?? null,
      contactPrenom: identRes.data?.prenom ?? null,
      accessCount: count ?? REPEAT_THRESHOLD,
    });
  } catch (err) {
    console.error("[reveal-alert] failed", err);
  }
}
