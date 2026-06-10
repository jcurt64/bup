/**
 * Notifications de résultat d'un FREEBUUPP tiré (`drawn`).
 *
 *  - Gagnants : notification in-app (broadcast ciblé) + mail Brevo + push Expo.
 *  - Perdants : notification in-app seule (pas de mail, pour ne pas spammer).
 *
 * In-app = insertion dans `admin_broadcasts` avec `target_clerk_user_id`
 * (même mécanisme que les messages système, cf. lib/prospect/non-response.ts).
 * À appeler une seule fois après un tirage réussi (fire-and-forget côté API/cron).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendFreebuuppWinnerEmail } from "@/lib/email/freebuupp-winner";
import { sendBatch, type ExpoPushMessage } from "@/lib/push/expo";

type Admin = SupabaseClient<Database>;

export async function notifyFreebuuppResults(admin: Admin, freebuuppId: string): Promise<void> {
  const { data: fb } = await admin
    .from("freebuupps")
    .select("id, code, title, prize_description, brand_name")
    .eq("id", freebuuppId)
    .single();
  if (!fb) return;

  const { data: parts } = await admin
    .from("freebuupp_participants")
    .select("prospect_id, participant_number, is_winner")
    .eq("freebuupp_id", freebuuppId);
  const all = parts ?? [];
  if (all.length === 0) return;

  const pids = all.map((p) => p.prospect_id);
  const [{ data: prospects }, { data: idents }] = await Promise.all([
    admin.from("prospects").select("id, clerk_user_id").in("id", pids),
    admin.from("prospect_identity").select("prospect_id, email, prenom").in("prospect_id", pids),
  ]);
  const clerkByProspect = new Map<string, string>();
  for (const p of prospects ?? []) if (p.clerk_user_id) clerkByProspect.set(p.id, p.clerk_user_id);
  const identByProspect = new Map<string, { email: string | null; prenom: string | null }>();
  for (const it of idents ?? []) {
    identByProspect.set(it.prospect_id, { email: it.email ?? null, prenom: it.prenom ?? null });
  }

  // 1. Notifications in-app (broadcast ciblé par prospect).
  const broadcastRows = all
    .map((p) => {
      const clerk = clerkByProspect.get(p.prospect_id);
      if (!clerk) return null;
      return {
        title: p.is_winner ? "🎉 Vous avez gagné un FREEBUUPP !" : "Tirage FREEBUUPP terminé",
        body: p.is_winner
          ? `Bravo ! Votre numéro #${p.participant_number} a gagné « ${fb.title} » de ${fb.brand_name}. ${fb.brand_name} va vous contacter par téléphone.`
          : `Le tirage « ${fb.title} » est terminé — pas cette fois. Tentez le prochain FREEBUUPP !`,
        audience: "prospects" as const,
        created_by_admin_id: "system:freebuupp",
        target_clerk_user_id: clerk,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (broadcastRows.length > 0) {
    const { error } = await admin.from("admin_broadcasts").insert(broadcastRows);
    if (error) console.error("[freebuupp/mail] broadcast insert failed", error.message);
  }

  const winners = all.filter((p) => p.is_winner);

  // 2. Mails gagnants (Brevo) — fire-and-forget groupé.
  await Promise.allSettled(
    winners.map((w) => {
      const ident = identByProspect.get(w.prospect_id);
      if (!ident?.email) return Promise.resolve();
      return sendFreebuuppWinnerEmail({
        email: ident.email,
        prenom: ident.prenom,
        brand: fb.brand_name,
        title: fb.title,
        prize: fb.prize_description,
        participantNumber: w.participant_number,
        code: fb.code,
      });
    }),
  );

  // 3. Push Expo gagnants.
  const winnerClerks = winners
    .map((w) => clerkByProspect.get(w.prospect_id))
    .filter((c): c is string => !!c);
  if (winnerClerks.length > 0) {
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("user_id, expo_token")
      .in("user_id", winnerClerks);
    const messages: ExpoPushMessage[] = (tokens ?? []).map((t) => ({
      to: t.expo_token,
      title: "🎉 Vous avez gagné un FREEBUUPP !",
      body: `Vous remportez « ${fb.title} » de ${fb.brand_name}.`,
      data: { type: "freebuupp_won", freebuuppId: fb.id, code: fb.code },
      sound: "default",
      priority: "high",
    }));
    if (messages.length > 0) await sendBatch(admin, messages);
  }
}
