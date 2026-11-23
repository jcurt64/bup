/**
 * « La Vitrine » — capture de la page d'accueil du site du pro, via le
 * service gratuit mShots de WordPress.com.
 *
 * Pièges constatés (23/11/2026) :
 *   • mShots répond 403 sans User-Agent de navigateur ;
 *   • tant que la capture n'est pas prête, il redirige vers une image
 *     d'attente générique WordPress (`/mshots/v1/default`, image/gif) — qui
 *     restait ensuite en cache 1 h côté prospect.
 * On passe donc par le serveur : seule une VRAIE capture (JPEG) est servie et
 * mise en cache ; sinon « pas encore prête » (non mis en cache) et le client
 * réessaie.
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export function mshotsUrl(websiteUrl: string, width = 640): string {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(websiteUrl)}?w=${width}`;
}

export type SitePreview =
  | { ok: true; body: ArrayBuffer; contentType: string }
  | { ok: false; reason: "pending" | "failed" };

export async function fetchSitePreview(websiteUrl: string, width = 640): Promise<SitePreview> {
  try {
    const res = await fetch(mshotsUrl(websiteUrl, width), {
      headers: { "user-agent": UA, accept: "image/*" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) return { ok: false, reason: "failed" };
    // Image d'attente : redirection vers /mshots/v1/default (gif).
    if (res.url.includes("/mshots/v1/default") || !type.startsWith("image/jpeg")) {
      return { ok: false, reason: "pending" };
    }
    return { ok: true, body: await res.arrayBuffer(), contentType: type };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Lance la génération de la capture dès la création de la campagne
 *  (fire-and-forget) pour qu'elle soit prête quand le prospect l'affiche. */
export function warmSitePreview(websiteUrl: string): void {
  void fetchSitePreview(websiteUrl).catch(() => undefined);
}
