/**
 * Client Supabase pour les Client Components, intégré à Clerk.
 *
 * On utilise `@supabase/supabase-js` directement plutôt que `@supabase/ssr` :
 * Clerk gère la session, donc on n'a pas besoin du cookie-syncing — et l'option
 * `accessToken` entre en conflit avec le mécanisme de cookies de `@supabase/ssr`.
 *
 * Usage dans un composant `"use client"` :
 *   const supabase = useSupabaseBrowserClient();
 *   const { data } = await supabase.from("prospects").select();
 *
 * Le JWT Clerk est récupéré via `useSession()` puis passé à chaque requête
 * Supabase. Validé par Supabase (Third-Party Auth provider) → `auth.jwt() ->>
 * 'sub'` renvoie l'ID Clerk dans les RLS.
 */

"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import type { Database } from "./types";

export function useSupabaseBrowserClient() {
  const { session } = useSession();

  // Mémoïse pour ne pas recréer le client à chaque render.
  return useMemo(() => {
    return createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        accessToken: async () => (await session?.getToken()) ?? null,
      },
    );
  }, [session]);
}
