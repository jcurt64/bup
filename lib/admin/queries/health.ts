/**
 * Récupère un instantané de la santé technique de la plateforme :
 * compteurs d'events `system.*` sur 24 h, dernières exécutions cron
 * (settle / lifecycle), dernier digest envoyé.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const DAY = 86_400_000;

export type HealthSnapshot = {
  windowHours: number;
  emailFailed24h: number;
  stripeWebhookFailed24h: number;
  cronFailed24h: number;
  lastDigestAt: string | null;
  lastWaitlistLaunchAt: string | null;
};

export async function fetchHealthSnapshot(): Promise<HealthSnapshot> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - DAY).toISOString();

  const [emailFailed, stripeFailed, cronFailed, digest, launch] = await Promise.all([
    admin.from("admin_events").select("id", { count: "exact", head: true })
      .eq("type", "system.email_failed").gte("created_at", since),
    admin.from("admin_events").select("id", { count: "exact", head: true })
      .eq("type", "system.stripe_webhook_failed").gte("created_at", since),
    admin.from("admin_events").select("id", { count: "exact", head: true })
      .eq("type", "system.cron_failed").gte("created_at", since),
    admin.from("admin_events").select("created_at")
      .eq("type", "system.digest_sent").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("waitlist").select("launch_email_sent_at")
      .not("launch_email_sent_at", "is", null).order("launch_email_sent_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    windowHours: 24,
    emailFailed24h: emailFailed.count ?? 0,
    stripeWebhookFailed24h: stripeFailed.count ?? 0,
    cronFailed24h: cronFailed.count ?? 0,
    lastDigestAt: digest.data?.created_at ?? null,
    lastWaitlistLaunchAt: launch.data?.launch_email_sent_at ?? null,
  };
}
