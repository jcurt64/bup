/**
 * Mail digest destiné aux admins. Deux usages :
 *   - severity = 'warning' → digest horaire (cron à :55)
 *   - severity = 'info' → digest 2× par jour (cron à 08:00 et 18:00)
 *
 * Le contenu est un tableau "type → count" + 5 derniers events bruts par
 * type. Si aucun event sur la fenêtre, on n'envoie rien (return silent).
 */
import type { Database } from "@/lib/supabase/types";
import { getFromAddress, getTransport } from "./transport";

type EventRow = Database["public"]["Tables"]["admin_events"]["Row"];

export async function sendAdminDigest(params: {
  severity: "warning" | "info";
  windowStart: Date;
  windowEnd: Date;
  events: EventRow[];
}): Promise<void> {
  const { severity, windowStart, windowEnd, events } = params;
  if (events.length === 0) return;
  const transport = getTransport();
  if (!transport) return;
  const recipients = (process.env.ADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) return;

  const byType = new Map<string, EventRow[]>();
  for (const e of events) {
    const arr = byType.get(e.type) ?? [];
    arr.push(e);
    byType.set(e.type, arr);
  }

  const lines: string[] = [];
  lines.push(`Digest BUUPP admin — sévérité ${severity}`);
  lines.push(`Fenêtre : ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);
  lines.push(`Total : ${events.length} events`);
  lines.push("");
  for (const [type, arr] of [...byType.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`• ${type} — ${arr.length}`);
    for (const e of arr.slice(0, 5)) {
      lines.push(`    - ${e.created_at} ${JSON.stringify(e.payload).slice(0, 160)}`);
    }
  }
  lines.push("");
  lines.push("Voir le dashboard : /buupp-admin");

  const subject = `[BUUPP DIGEST ${severity.toUpperCase()}] ${events.length} events`;

  try {
    await transport.sendMail({
      from: getFromAddress(),
      to: recipients.join(", "),
      subject,
      text: lines.join("\n"),
    });
  } catch (err) {
    console.error("[email/admin-digest] sendMail failed", err);
  }
}
