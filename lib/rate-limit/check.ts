/**
 * Rate limiter fixed-window backé par la table `rate_limits` (Supabase).
 *
 * Usage type :
 *
 *   const limit = await checkRateLimit({
 *     key: `waitlist:ip:${ipHash}`,
 *     limit: 5,
 *     windowSec: 60,
 *   });
 *   if (!limit.allowed) {
 *     return NextResponse.json(
 *       { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
 *       { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
 *     );
 *   }
 *
 * Stratégie : fixed-window (vs sliding). Une fenêtre de durée fixe
 * démarre au 1er hit ; les hits suivants dans la fenêtre incrémentent
 * le compteur ; passé la fenêtre, le compteur est ré-initialisé.
 *
 * Avantages :
 * - 1 seul upsert par hit (coût constant, pas de scan).
 * - Logique simple, facile à raisonner.
 *
 * Inconvénient : pic possible à la frontière de fenêtre (2× la limite
 * sur l'intervalle qui chevauche la frontière). Acceptable ici car les
 * limites sont volontairement basses et les fenêtres courtes (60s-1h).
 *
 * Le hash IP doit être calculé côté appelant avec un sel stable (ne pas
 * stocker l'IP en clair pour rester RGPD-friendly).
 */

import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type RateLimitOptions = {
  /** Identifiant unique de la combinaison (endpoint × sujet). 8-200 chars. */
  key: string;
  /** Nombre max de hits autorisés dans la fenêtre. */
  limit: number;
  /** Durée de la fenêtre en secondes. */
  windowSec: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Hits utilisés dans la fenêtre courante (après le hit en cours). */
  hits: number;
  /** Hits restants dans la fenêtre. 0 = à la limite. */
  remaining: number;
  /** Si bloqué : nb de secondes à attendre avant de pouvoir réessayer. */
  retryAfterSec: number;
};

/**
 * Hash une IP avec un sel applicatif (RGPD : pas d'IP en clair).
 * Le sel `RATE_LIMIT_IP_SALT` doit être défini en env, sinon fallback sur
 * une valeur fixe (moins sécurisé mais évite un crash en dev).
 */
export function hashIp(rawIp: string | null | undefined): string {
  const ip = (rawIp ?? "").trim();
  if (!ip) return "no-ip";
  const salt = process.env.RATE_LIMIT_IP_SALT ?? process.env.WAITLIST_IP_SALT ?? "buupp";
  return crypto
    .createHash("sha256")
    .update(ip + salt)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Extrait l'IP cliente de la requête (header X-Forwarded-For en
 * priorité, X-Real-IP en fallback). Retourne `null` si aucun header.
 */
export function getClientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const { key, limit, windowSec } = opts;
  if (key.length < 8 || key.length > 200) {
    throw new Error(`checkRateLimit: invalid key length (${key.length})`);
  }
  if (limit < 1 || windowSec < 1) {
    throw new Error("checkRateLimit: limit and windowSec must be >= 1");
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const windowStartCutoff = new Date(now.getTime() - windowSec * 1000);

  // Lecture de l'état actuel.
  const { data: existing } = await admin
    .from("rate_limits")
    .select("count, window_start_at")
    .eq("key", key)
    .maybeSingle();

  // Cas 1 : pas de row, ou la fenêtre est expirée → on (ré)initialise.
  if (!existing || new Date(existing.window_start_at) < windowStartCutoff) {
    const { error } = await admin
      .from("rate_limits")
      .upsert(
        {
          key,
          count: 1,
          window_start_at: now.toISOString(),
          first_hit_at: existing ? undefined : now.toISOString(),
        },
        { onConflict: "key" },
      );
    if (error) {
      // Fail-open : si la base est down, on n'empêche pas la requête —
      // la sécurité applicative (Clerk, validations) reste en place.
      console.error("[rate-limit] upsert failed (fail-open):", error);
      return { allowed: true, hits: 1, remaining: limit - 1, retryAfterSec: 0 };
    }
    return { allowed: true, hits: 1, remaining: limit - 1, retryAfterSec: 0 };
  }

  // Cas 2 : fenêtre encore valide.
  const newCount = existing.count + 1;
  if (newCount > limit) {
    // Bloqué. Calcule le délai avant la prochaine fenêtre.
    const windowEndAt = new Date(existing.window_start_at).getTime() + windowSec * 1000;
    const retryAfterSec = Math.max(1, Math.ceil((windowEndAt - now.getTime()) / 1000));
    return {
      allowed: false,
      hits: existing.count,
      remaining: 0,
      retryAfterSec,
    };
  }

  // Sinon, on incrémente.
  const { error } = await admin
    .from("rate_limits")
    .update({ count: newCount })
    .eq("key", key);
  if (error) {
    console.error("[rate-limit] update failed (fail-open):", error);
  }
  return {
    allowed: true,
    hits: newCount,
    remaining: Math.max(0, limit - newCount),
    retryAfterSec: 0,
  };
}
