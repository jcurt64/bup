/**
 * useAuthedDownload — téléchargement authentifié (Bearer Clerk) pour routes
 * protégées. WebBrowser.openBrowserAsync n'envoie aucun header Authorization,
 * donc les routes /api/* renvoient 401. Ce hook récupère le token Clerk, télécharge
 * le fichier via expo-file-system (File.downloadFileAsync + header Bearer), puis
 * ouvre la feuille de partage système avec expo-sharing.
 *
 * Robustesse (revue T19) :
 *  - Fix 1 : downloadFileAsync rejette déjà sur non-2xx (SDK 19 / expo-file-system@19.x)
 *    avec une erreur "UnableToDownload" contenant le code HTTP — on la re-capture et
 *    on lève une ApiError homogène pour que les callers voient toujours la même forme.
 *  - Fix 2 : guard token nul avant toute tentative réseau.
 *  - Fix 3 : nom de fichier assaini + suffixe d'unicité pour éviter les collisions cache.
 *  - Fix 4 : suppression du fichier existant enveloppée dans try/catch.
 */
import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { apiBase, ApiError } from "./api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitise un nom de fichier brut en un nom de fichier sûr pour le cache.
 * - Supprime le querystring (coupe à `?`)
 * - Supprime les séparateurs de répertoires
 * - N'autorise que [A-Za-z0-9._\-() ] — remplace le reste par `_`
 * - Tronque à 120 chars
 * - Insère un suffixe d'unicité AVANT l'extension (ou en fin de nom si absent)
 *   pour éviter les collisions sur des noms prévisibles (ex. "recap").
 * - Retourne `download-${Date.now()}` si le résultat est vide.
 */
function sanitizeFilename(raw: string, suffix: string): string {
  // Strip querystring
  const noQuery = raw.split("?")[0]!;
  // Strip directory separators
  const base = noQuery.replace(/[/\\]/g, "");
  // Allow only safe chars
  const safe = base.replace(/[^A-Za-z0-9._\-() ]/g, "_");
  // Truncate
  const truncated = safe.slice(0, 120);

  if (!truncated) {
    return `download-${suffix}`;
  }

  // Insert suffix before extension (if present) or at the end
  const dotIndex = truncated.lastIndexOf(".");
  if (dotIndex > 0) {
    return `${truncated.slice(0, dotIndex)}-${suffix}${truncated.slice(dotIndex)}`;
  }
  return `${truncated}-${suffix}`;
}

/**
 * Extract an HTTP status code from an expo-file-system "UnableToDownload" error
 * message. The SDK embeds the code as a number in the message string.
 * Falls back to 0 if no code can be parsed.
 */
function parseHttpStatus(err: unknown): number {
  if (err instanceof Error) {
    const match = err.message.match(/\b([1-5]\d{2})\b/);
    if (match) return parseInt(match[1]!, 10);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Retourne une fonction stable `download(path, filename?)` qui :
 *  1. Vérifie que l'utilisateur est authentifié et obtient le token Clerk.
 *  2. Télécharge `${apiBase()}${path}` dans le répertoire cache avec le header
 *     `Authorization: Bearer <token>`.
 *  3. Ouvre la feuille de partage/prévisualisation système si disponible.
 *
 * @param path  - chemin commençant par `/api/...`
 * @param filename - nom de fichier suggéré (facultatif, sinon déduit de l'URL)
 * @throws ApiError si le serveur répond en non-2xx.
 * @throws Error si le partage n'est pas disponible ou si l'utilisateur n'est pas connecté.
 */
export function useAuthedDownload(): (
  path: string,
  filename?: string,
) => Promise<void> {
  const { getToken, isSignedIn } = useAuth();

  return useCallback(
    async (path: string, filename?: string) => {
      // Fix 2 — guard token nul avant tout appel réseau
      const token = isSignedIn ? await getToken() : null;
      if (!token) throw new Error("Non authentifié — reconnectez-vous.");

      const url = `${apiBase()}${path}`;

      // Fix 3 — nom de fichier assaini + suffixe d'unicité
      const suffix = String(Date.now());
      const rawName =
        filename ??
        decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
      const safeName = sanitizeFilename(rawName || "download", suffix);

      const destination = new File(Paths.cache, safeName);

      // Fix 4 — suppression best-effort (une erreur ici ne doit pas masquer
      // l'erreur réelle du téléchargement).
      if (destination.exists) {
        try {
          destination.delete();
        } catch {
          /* ignore — le fichier sera peut-être écrasé ou le téléchargement
             échouera avec DestinationAlreadyExists, ce qui est traitable */
        }
      }

      // Fix 1 — expo-file-system@19.x (SDK 54) : downloadFileAsync rejette
      // déjà avec une erreur "UnableToDownload" sur tout statut non-2xx ; aucun
      // fichier n'est créé dans ce cas. On intercepte cette erreur pour la
      // re-lancer sous forme d'ApiError homogène (même shape que useApi).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let downloaded: { uri: string };
      try {
        downloaded = await File.downloadFileAsync(url, destination, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        const status = parseHttpStatus(err);
        if (status >= 100) {
          // HTTP error from the server — wrap as ApiError
          throw new ApiError(
            status,
            err instanceof Error ? err.message : String(err),
          );
        }
        // Network/other error — re-throw as-is
        throw err;
      }

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error(
          "Le partage de fichiers n'est pas disponible sur cet appareil.",
        );
      }

      await Sharing.shareAsync(downloaded.uri);
    },
    [getToken, isSignedIn],
  );
}
