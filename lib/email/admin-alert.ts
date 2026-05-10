/**
 * Mail d'alerte critique destiné aux admins (allowlist `ADMIN_EMAILS`).
 * Envoyé immédiatement (pas de digest) à chaque event severity = 'critical'.
 *
 * Si SMTP n'est pas configuré (cf. `lib/email/transport.ts`) ou si
 * `ADMIN_EMAILS` est vide, on log et on revient sans erreur.
 */
import { getFromAddress, getTransport } from "./transport";

export type AdminAlertParams = {
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export async function sendAdminCriticalAlert(p: AdminAlertParams): Promise<void> {
  const transport = getTransport();
  if (!transport) return;
  const recipients = (process.env.ADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) {
    console.warn("[email/admin-alert] ADMIN_EMAILS vide — skip");
    return;
  }
  const subject = `[BUUPP CRITICAL] ${p.type}`;
  const text = [
    `Évènement critique détecté : ${p.type}`,
    `Reçu : ${p.createdAt}`,
    "",
    "Payload :",
    JSON.stringify(p.payload, null, 2),
    "",
    "Ouvrir le dashboard : /buupp-admin",
  ].join("\n");
  try {
    await transport.sendMail({
      from: getFromAddress(),
      to: recipients.join(", "),
      subject,
      text,
    });
  } catch (err) {
    console.error("[email/admin-alert] sendMail failed", err);
  }
}
