/**
 * Lien de désabonnement en un clic du récapitulatif e-mail Tests & Études.
 * Jeton = base64url(prospectId) + "." + HMAC-SHA256 tronqué. Pas de
 * donnée personnelle dans l'URL au-delà de l'identifiant technique.
 */
import crypto from "node:crypto";

function secret(): string {
  const s = process.env.STUDIES_UNSUB_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (s.length < 32) throw new Error("studies unsubscribe secret missing");
  return s;
}

const mac = (payload: string) =>
  crypto.createHmac("sha256", secret()).update(`studies-unsub:${payload}`).digest("base64url").slice(0, 32);

export function signUnsubscribe(prospectId: string): string {
  const p = Buffer.from(prospectId).toString("base64url");
  return `${p}.${mac(p)}`;
}

export function verifyUnsubscribe(token: string): string | null {
  const [p, sig] = token.split(".");
  if (!p || !sig) return null;
  const expected = mac(p);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const id = Buffer.from(p, "base64url").toString();
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}
