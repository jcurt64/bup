import { fetchHealthSnapshot } from "@/lib/admin/queries/health";

export const dynamic = "force-dynamic";

export default async function HealthAdminPage() {
  const h = await fetchHealthSnapshot();
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <Box label="Email failed (24h)" value={h.emailFailed24h} bad={h.emailFailed24h > 0} />
      <Box label="Stripe webhook failed (24h)" value={h.stripeWebhookFailed24h} bad={h.stripeWebhookFailed24h > 0} />
      <Box label="Cron failed (24h)" value={h.cronFailed24h} bad={h.cronFailed24h > 0} />
      <Box label="Dernier digest" value={h.lastDigestAt ? new Date(h.lastDigestAt).toLocaleString("fr-FR") : "Jamais"} />
      <Box label="Dernier mail waitlist" value={h.lastWaitlistLaunchAt ? new Date(h.lastWaitlistLaunchAt).toLocaleString("fr-FR") : "Jamais"} />
    </div>
  );
}
function Box({ label, value, bad }: { label: string; value: number | string; bad?: boolean }) {
  return (
    <div
      className="rounded p-3"
      style={{
        background: bad ? "rgba(185,28,28,0.06)" : "var(--paper)",
        border: "1px solid var(--line)",
        borderLeft: bad ? "3px solid var(--danger)" : "3px solid var(--good)",
      }}
    >
      <div
        className="text-[11px] font-bold uppercase"
        style={{ color: bad ? "var(--danger)" : "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
      >
        {label}
      </div>
      <div
        className="text-base font-semibold tabular-nums mt-0.5"
        style={{ color: bad ? "var(--danger)" : "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}
