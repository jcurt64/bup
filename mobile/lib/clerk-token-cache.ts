// Cache de token Clerk persistant via expo-secure-store (Keychain iOS /
// Keystore Android). Indispensable pour que la session survive aux
// redémarrages de l'app. Cf. MOBILE_APP_SPEC.md §2.1.
import * as SecureStore from "expo-secure-store";
import type { TokenCache } from "@clerk/clerk-expo";

export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* best-effort */
    }
  },
};
