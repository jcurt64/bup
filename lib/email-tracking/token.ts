/**
 * Tokens d'opt-out 1-clic pour le tracking des broadcasts email.
 *
 * Inclus dans chaque broadcast (footer + corps de l'email), permettent à
 * un destinataire de s'opposer au tracking en cliquant sur un seul lien,
 * SANS se reconnecter. Le token authentifie le destinataire via une
 * signature HMAC-SHA256 du payload (clerk_user_id + role).
 *
 * Sécurité : la signature est tronquée à 32 hex chars (128 bits) — assez
 * pour rendre la forge inviable, suffisamment court pour des URLs propres.
 * Le secret `BUUPP_TOKEN_SECRET` doit être posé en env (cf. .env.example).
 * Fallback dev volontairement faible pour ne pas casser le local sans env.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type OptOutPayload = {
  userId: string;
  role: "prospect" | "pro";
};

function getSecret(): string {
  // En prod le secret DOIT être posé. En dev/test on tombe sur une
  // valeur fixe peu sensible — un attaquant peut forger, mais l'impact
  // est limité à mettre `email_tracking_consent` à false sur un
  // compte. Pas catastrophique mais à éviter en prod.
  return process.env.BUUPP_TOKEN_SECRET || "dev-only-buupp-opt-out-token-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex").slice(0, 32);
}

/**
 * Génère un token opt-out signé pour un destinataire. Format :
 *   `<base64url(userId:role)>.<32-hex-sig>`
 */
export function signOptOutToken(payload: OptOutPayload): string {
  const raw = `${payload.userId}:${payload.role}`;
  const b64 = Buffer.from(raw, "utf-8").toString("base64url");
  const sig = sign(raw);
  return `${b64}.${sig}`;
}

/**
 * Vérifie un token opt-out reçu en query string. Retourne le payload si
 * valide, null sinon. Utilise `timingSafeEqual` pour éviter une fuite par
 * timing attack sur la comparaison de la signature.
 */
export function verifyOptOutToken(token: string | null | undefined): OptOutPayload | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot >= token.length - 1) return null;
  const b64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  let raw: string;
  try {
    raw = Buffer.from(b64, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const [userId, role] = raw.split(":");
  if (!userId || (role !== "prospect" && role !== "pro")) return null;

  const expected = sign(raw);
  if (providedSig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(providedSig, "utf-8"), Buffer.from(expected, "utf-8"))) {
      return null;
    }
  } catch {
    return null;
  }
  return { userId, role };
}
