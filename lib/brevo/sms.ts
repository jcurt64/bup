/**
 * Brevo (ex-Sendinblue) — envoi SMS transactionnel.
 *
 * Brevo est un simple "SMS gateway" : pas d'API "Verify" intégrée comme
 * Twilio Verify. On génère donc le code OTP côté BUUPP, on en stocke le
 * hash dans `prospect_phone_otp`, et on demande à Brevo d'envoyer le
 * texte. Brevo ne valide pas le code à notre place.
 *
 * Env vars :
 *   BREVO_API_KEY       (commence par xkeysib-…)
 *   BREVO_SMS_SENDER    (optionnel, max 11 chars alphanumériques) —
 *                       par défaut "BUUPP".
 *
 * Si la clé manque, on bascule en "dev mode" : pas d'envoi réel,
 * retour { devMode: true }. Le code OTP est alors loggé serveur et
 * renvoyé au client pour faciliter le test du flow.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/transactionalSMS/sms";

export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}

/** Envoie un SMS transactionnel. Lève en cas d'erreur Brevo. */
export async function sendSms(
  phoneE164: string,
  content: string,
): Promise<{ devMode: boolean; messageId?: number }> {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = (process.env.BREVO_SMS_SENDER || "BUUPP").slice(0, 11);

  if (!apiKey) {
    console.info(`[brevo/sms] dev mode (no API key) → ${phoneE164} : ${content}`);
    return { devMode: true };
  }

  // Diagnostic : on log le préfixe et la longueur de la clé sans
  // jamais imprimer la valeur complète (sensible). Permet de repérer
  // une clé tronquée ou un préfixe inattendu.
  const prefix = apiKey.slice(0, 9);
  console.info(
    `[brevo/sms] using key prefix="${prefix}…" length=${apiKey.length} (expected: starts with "xkeysib-", ~80 chars)`,
  );

  const r = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender,            // alphanumérique, max 11 chars (norme GSM)
      recipient: phoneE164, // E.164
      content,           // max 160 chars (au-delà → SMS multi-parts facturés à part)
      type: "transactional",
    }),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    let message = `Brevo SMS API error ${r.status}`;
    try {
      const j = JSON.parse(text) as { message?: string; code?: string };
      if (j.message) message = `${message}: ${j.message}`;
      if (j.code) message = `${message} (code=${j.code})`;
    } catch {
      if (text) message = `${message}: ${text.slice(0, 200)}`;
    }
    throw new Error(message);
  }

  const j = (await r.json().catch(() => ({}))) as { messageId?: number };
  return { devMode: false, messageId: j.messageId };
}
