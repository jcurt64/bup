/**
 * Lecture de l'interrupteur « boutons d'accès » (`app_config`).
 *
 * Pendant la période de pré-inscription, les entrées vers l'inscription et
 * la connexion sont gelées sur les pages publiques : les boutons restent
 * visibles mais inertes, avec une infobulle « Actif au lancement ». Seule
 * la pré-inscription reste cliquable.
 *
 * Piloté par la base et non par le code pour pouvoir rouvrir l'accès sans
 * redéploiement — cf. migration 20260728120000.
 *
 * Le résultat est mis en cache 60 s (`unstable_cache`) : sans cela, la
 * lecture rendrait dynamiques les pages qui l'appellent (accueil, à propos,
 * contact) et coûterait une invocation de fonction à chaque visite. Avec le
 * cache, les pages restent servies depuis le CDN et une réouverture se
 * propage en une minute.
 *
 * `cacheComponents` n'est pas activé sur ce projet, donc `use cache` /
 * `cacheLife` ne sont pas disponibles ici — `unstable_cache` reste l'API
 * adaptée à cette version.
 */

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const ACCESS_FLAG_TAG = "app-config:access-buttons";

export const getAccessButtonsEnabled = unstable_cache(
  async (): Promise<boolean> => {
    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("app_config")
        .select("access_buttons_enabled")
        .maybeSingle();
      if (error) {
        console.error("[app-config/access] read failed", error);
        return true;
      }
      // Fail-open : en cas de lecture impossible on laisse l'accès ouvert.
      // Bloquer les inscriptions sur une panne transitoire coûterait plus
      // cher que de laisser fuiter les boutons pendant le gel — d'autant
      // que sans base, les parcours derrière ces boutons ne marchent pas
      // non plus.
      return data?.access_buttons_enabled !== false;
    } catch (err) {
      console.error("[app-config/access] unexpected", err);
      return true;
    }
  },
  [ACCESS_FLAG_TAG],
  { revalidate: 60, tags: [ACCESS_FLAG_TAG] },
);
