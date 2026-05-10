/**
 * Helper d'insertion fire-and-forget dans `admin_events`.
 *
 * Appelé depuis les chemins métier (signups, campagnes, relations,
 * transactions, erreurs SMTP/Stripe). Ne bloque jamais le chemin
 * critique : les exceptions sont logguées et avalées (sinon on risque
 * d'aggraver l'incident qu'on essaie de tracer).
 *
 *   void recordEvent({ type: "prospect.signup", prospectId });
 *
 * Ne jamais `await` côté handler métier — utiliser `void` pour que
 * l'IDE et eslint ne rouspètent pas, et passer à la suite.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Severity = Database["public"]["Enums"]["admin_event_severity"];

export type RecordEventInput = {
  type: string;
  severity?: Severity;
  payload?: Record<string, unknown>;
  prospectId?: string | null;
  proAccountId?: string | null;
  campaignId?: string | null;
  relationId?: string | null;
  transactionId?: string | null;
};

export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("admin_events").insert({
      type: input.type,
      severity: input.severity ?? "info",
      payload: input.payload ?? {},
      prospect_id: input.prospectId ?? null,
      pro_account_id: input.proAccountId ?? null,
      campaign_id: input.campaignId ?? null,
      relation_id: input.relationId ?? null,
      transaction_id: input.transactionId ?? null,
    });
    if (error) {
      console.error("[admin/events/record] insert failed", {
        type: input.type,
        error,
      });
    }
  } catch (err) {
    console.error("[admin/events/record] unexpected", {
      type: input.type,
      err,
    });
  }
}
