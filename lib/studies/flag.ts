/**
 * Interrupteur du module (`app_config.studies_enabled`, défaut false).
 * Fail-closed : en cas de lecture impossible, le module reste masqué.
 * En dev, `STUDIES_FORCE_ENABLED=1` force l'ouverture (jamais en prod).
 */
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const STUDIES_FLAG_TAG = "app-config:studies";

const readFlag = unstable_cache(
  async (): Promise<boolean> => {
    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.from("app_config").select("studies_enabled").maybeSingle();
      if (error) return false;
      return Boolean(data?.studies_enabled);
    } catch {
      return false;
    }
  },
  ["app-config-studies-enabled"],
  { revalidate: 60, tags: [STUDIES_FLAG_TAG] },
);

export async function getStudiesEnabled(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production" && process.env.STUDIES_FORCE_ENABLED === "1") return true;
  return readFlag();
}
