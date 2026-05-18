// Wrapper d'appel à l'API web BUUPP (source unique — cf.
// MOBILE_APP_SPEC.md §0/§2.2). Toutes les routes /api/* sont consommées
// avec le token de session Clerk en `Authorization: Bearer`. Les routes
// /api/* protégées renvoient un 401 JSON (et non un 307) — corrigé côté
// web, commit 0dd91a0.
import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`API ${status}`);
    this.status = status;
    this.body = body;
  }
}

if (!BASE) {
  // Échoue tôt et clairement plutôt qu'un fetch("undefined/...").
  console.warn(
    "[api] EXPO_PUBLIC_API_BASE_URL manquant — copier .env.example en .env",
  );
}

/**
 * Hook renvoyant une fonction `api<T>(path, init?)` authentifiée.
 * - `path` commence par `/api/...`
 * - 401 → ApiError (le client doit déclencher une reconnexion Clerk)
 */
export function useApi() {
  const { getToken, isSignedIn } = useAuth();

  return useCallback(
    async function api<T>(path: string, init?: RequestInit): Promise<T> {
      const token = isSignedIn ? await getToken() : null;
      const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) {
        throw new ApiError(res.status, await res.text().catch(() => ""));
      }
      // 204 / corps vide toléré
      const text = await res.text();
      return (text ? JSON.parse(text) : null) as T;
    },
    [getToken, isSignedIn],
  );
}
