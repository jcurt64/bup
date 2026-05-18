/**
 * useAuthedDownload — téléchargement authentifié (Bearer Clerk) pour routes
 * protégées. WebBrowser.openBrowserAsync n'envoie aucun header Authorization,
 * donc les routes /api/* renvoient 401. Ce hook récupère le token Clerk, télécharge
 * le fichier via expo-file-system (File.downloadFileAsync + header Bearer), puis
 * ouvre la feuille de partage système avec expo-sharing.
 */
import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { apiBase } from "./api";

/**
 * Retourne une fonction stable `download(path, filename?)` qui :
 *  1. Obtient le token Clerk courant.
 *  2. Télécharge `${apiBase()}${path}` dans le répertoire cache avec le header
 *     `Authorization: Bearer <token>`.
 *  3. Ouvre la feuille de partage/prévisualisation système si disponible.
 *
 * @param path  - chemin commençant par `/api/...`
 * @param filename - nom de fichier suggéré (facultatif, sinon déduit de l'URL)
 * @throws si le téléchargement échoue ou si le partage n'est pas disponible.
 */
export function useAuthedDownload(): (
  path: string,
  filename?: string,
) => Promise<void> {
  const { getToken, isSignedIn } = useAuth();

  return useCallback(
    async (path: string, filename?: string) => {
      const token = isSignedIn ? await getToken() : null;
      const url = `${apiBase()}${path}`;

      // Derive a filename from the hint or the last URL segment.
      const fromPath =
        decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "") ||
        `download-${Date.now()}`;
      const defaultName = filename ?? fromPath;

      const destination = new File(Paths.cache, defaultName);

      // If a stale file exists from a previous call, remove it so downloadFileAsync
      // doesn't reject with DestinationAlreadyExists.
      if (destination.exists) {
        destination.delete();
      }

      // SDK 54 new API: File.downloadFileAsync(url, destination, options)
      // with headers: { Authorization } to carry the Clerk Bearer token.
      const downloaded = await File.downloadFileAsync(url, destination, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.");
      }

      await Sharing.shareAsync(downloaded.uri);
    },
    [getToken, isSignedIn],
  );
}
