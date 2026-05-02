/**
 * Clients Supabase côté serveur (RSC, Route Handlers, Server Actions).
 *
 * On utilise `@supabase/supabase-js` directement (et non `@supabase/ssr`)
 * parce que la session est gérée par Clerk, pas par les cookies Supabase.
 * `@supabase/ssr` essaie de wirer `onAuthStateChange` pour synchroniser
 * les cookies → conflit avec l'option `accessToken` qui désactive ce mécanisme.
 *
 * Deux clients distincts :
 *
 * - `createSupabaseServerClient()` → utilise le token Clerk du visiteur
 *   pour appliquer les RLS (lecture/écriture au nom de l'utilisateur).
 *
 * - `createSupabaseAdminClient()` → bypass RLS via la `service_role` key.
 *   À réserver aux webhooks et jobs back-office. JAMAIS exposé au navigateur.
 */

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export async function createSupabaseServerClient() {
  const { getToken } = await auth();

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Clerk gère la session : on désactive le storage et l'auto-refresh
      // Supabase qui ne servent à rien dans ce contexte.
      auth: { persistSession: false, autoRefreshToken: false },
      // Fonction appelée à chaque requête pour récupérer le JWT Clerk frais.
      accessToken: async () => (await getToken()) ?? null,
    },
  );
}

/**
 * Client à privilèges élevés (`service_role`) — bypass RLS.
 *
 * Usage strict : webhooks Stripe/Clerk, jobs CRON, scripts de migration.
 * Ne jamais propager le résultat à un Server Component qui le retourne au navigateur.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
