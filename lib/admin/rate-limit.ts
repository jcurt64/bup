/**
 * Rate-limit naïf in-memory (60 req/min/IP). Suffit en V1 pour empêcher
 * un scrap massif si une session admin est volée. À remplacer par
 * Upstash/Redis si on déploie sur plusieurs instances.
 */
const buckets = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const LIMIT = 60;

export function rateLimit(req: Request): Response | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const now = Date.now();
  const arr = (buckets.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) {
    return new Response("Too Many Requests", { status: 429 });
  }
  arr.push(now);
  buckets.set(ip, arr);
  return null;
}
